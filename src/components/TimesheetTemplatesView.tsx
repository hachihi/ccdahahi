import React, { useMemo, useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Calendar, Search, Cpu, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadCsv } from '../services/dahahiService';
import {
  DEFAULT_SHIFT,
  ReportFilter,
  ShiftConfig,
  buildDailyDetailReport,
  buildMachineDetailReport,
  downloadExcel,
  formatDateVi
} from '../services/timesheetReportService';
import { AttendanceLog, ConnectionSettings, DahahiMachine, Employee } from '../types/dahahi';

export type TemplateId = 'machine' | 'daily';

interface Props {
  template: TemplateId;
  logs: AttendanceLog[];
  employees: Employee[];
  machines: DahahiMachine[];
  settings: ConnectionSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const PAGE_SIZE = 100;

const inputCls =
  'px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500';
const thCls = 'py-3 px-3 text-center font-semibold whitespace-nowrap border-r border-slate-200 dark:border-slate-700 last:border-r-0';
const tdCls = 'py-2 px-3 whitespace-nowrap border-r border-slate-100 dark:border-slate-800 last:border-r-0';

export const TimesheetTemplatesView: React.FC<Props> = ({
  template,
  logs,
  employees,
  machines,
  settings,
  showToast
}) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [machineId, setMachineId] = useState('all');
  const [department, setDepartment] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [dedupeSeconds, setDedupeSeconds] = useState(60);
  const [page, setPage] = useState(1);
  const [shift, setShift] = useState<ShiftConfig>({
    ...DEFAULT_SHIFT,
    start: settings.workStartTime || DEFAULT_SHIFT.start,
    end: settings.workEndTime || DEFAULT_SHIFT.end
  });

  // Đồng bộ giờ chuẩn khi cấu hình hệ thống tải xong
  useEffect(() => {
    setShift(s => ({
      ...s,
      start: settings.workStartTime || s.start,
      end: settings.workEndTime || s.end
    }));
  }, [settings.workStartTime, settings.workEndTime]);

  useEffect(() => setPage(1), [template, month, machineId, department, keyword, dedupeSeconds]);

  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department || 'Chung'))).sort(),
    [employees]
  );

  const filter: ReportFilter = { month, machineId, department, keyword, dedupeSeconds };

  const machineReport = useMemo(
    () => (template === 'machine' ? buildMachineDetailReport(logs, employees, machines, filter) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, logs, employees, machines, month, machineId, department, keyword, dedupeSeconds]
  );
  const dailyReport = useMemo(
    () => (template === 'daily' ? buildDailyDetailReport(logs, employees, filter, shift) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, logs, employees, month, machineId, department, keyword, dedupeSeconds, shift]
  );

  const total = template === 'machine' ? machineReport!.rows.length : dailyReport!.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  const machineLabel =
    machineId === 'all' ? 'Tất cả máy' : machines.find(m => m.MachineBoxId === machineId)?.MachineName || machineId;
  const deptLabel = department === 'all' ? 'Tất cả phòng ban' : department;
  const subtitle = `Tháng ${month.slice(5)}/${month.slice(0, 4)}  |  ${machineLabel}  |  ${deptLabel}`;

  /* ---------------------- Xuất file ---------------------- */
  const getExportData = () => {
    if (template === 'machine') {
      const { rows, maxPunches } = machineReport!;
      const headers = [
        'Mã NV',
        'Tên NV',
        'Ngày',
        'Máy',
        ...Array.from({ length: maxPunches }, (_, i) => `Lần ${i + 1}`)
      ];
      const data = rows.map(r => [
        r.code,
        r.name,
        formatDateVi(r.date),
        r.machineName,
        ...Array.from({ length: maxPunches }, (_, i) => r.punches[i] || '')
      ]);
      return {
        title: 'BÁO CÁO CHẤM CÔNG CHI TIẾT THEO MÁY',
        file: `bao_cao_cham_cong_theo_may_${month}`,
        headers,
        data,
        leftAlign: [1, 3],
        textCols: [0]
      };
    }
    const headers = [
      'STT',
      'Mã NV',
      'Họ và tên',
      'Phòng ban',
      'Ngày',
      'Vào sớm nhất (MIN)',
      'Ra muộn nhất (MAX)',
      'Mã ca',
      'Giờ vào chuẩn',
      'Giờ ra chuẩn',
      'Phút vào trễ',
      'Phút về sớm',
      'Giờ công',
      'Ghi chú'
    ];
    const data = dailyReport!.map(r => [
      r.stt,
      r.code,
      r.name,
      r.department,
      formatDateVi(r.date),
      r.firstIn,
      r.lastOut,
      r.shiftCode,
      r.stdIn,
      r.stdOut,
      r.lateMinutes,
      r.earlyMinutes,
      r.workHours.toFixed(2),
      r.note
    ]);
    return {
      title: 'BÁO CÁO CHẤM CÔNG CHI TIẾT',
      file: `bao_cao_cham_cong_chi_tiet_${month}`,
      headers,
      data,
      leftAlign: [2, 3, 13],
      textCols: [1]
    };
  };

  const handleExcel = () => {
    const d = getExportData();
    if (d.data.length === 0) {
      showToast('Không có dữ liệu để xuất', 'error');
      return;
    }
    downloadExcel(`${d.file}.xls`, {
      title: d.title,
      subtitle,
      headers: d.headers,
      rows: d.data,
      leftAlignCols: d.leftAlign,
      textCols: d.textCols
    });
    showToast(`Đã xuất ${d.data.length} dòng ra Excel`, 'success');
  };

  const handleCsv = () => {
    const d = getExportData();
    if (d.data.length === 0) {
      showToast('Không có dữ liệu để xuất', 'error');
      return;
    }
    downloadCsv(`${d.file}.csv`, d.headers, d.data);
    showToast(`Đã xuất ${d.data.length} dòng ra CSV`, 'success');
  };

  /* ---------------------- Giao diện ---------------------- */
  const pageRows = <T,>(arr: T[]) => arr.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-500" />
            Tháng
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Cpu className="w-4 h-4 text-blue-500" />
            Máy
            <select value={machineId} onChange={e => setMachineId(e.target.value)} className={inputCls}>
              <option value="all">Tất cả máy</option>
              {machines.map(m => (
                <option key={m.MachineBoxId} value={m.MachineBoxId}>
                  {m.MachineName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-amber-500" />
            Phòng ban
            <select value={department} onChange={e => setDepartment(e.target.value)} className={inputCls}>
              <option value="all">Tất cả</option>
              {departments.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã / tên NV…"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className={`${inputCls} w-44`}
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Bỏ chấm trùng trong
            <select
              value={dedupeSeconds}
              onChange={e => setDedupeSeconds(Number(e.target.value))}
              className={inputCls}
            >
              <option value={0}>Không lọc</option>
              <option value={30}>30 giây</option>
              <option value={60}>1 phút</option>
              <option value={180}>3 phút</option>
              <option value={300}>5 phút</option>
            </select>
          </label>
        </div>

        {template === 'daily' && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Ca làm việc:</span>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mã ca
              <input
                type="text"
                value={shift.code}
                onChange={e => setShift({ ...shift, code: e.target.value })}
                className={`${inputCls} w-20`}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Giờ vào
              <input
                type="time"
                value={shift.start}
                onChange={e => setShift({ ...shift, start: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Giờ ra
              <input
                type="time"
                value={shift.end}
                onChange={e => setShift({ ...shift, end: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nghỉ trưa từ
              <input
                type="time"
                value={shift.breakStart}
                onChange={e => setShift({ ...shift, breakStart: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Số phút nghỉ
              <input
                type="number"
                min={0}
                max={240}
                value={shift.breakMinutes}
                onChange={e => setShift({ ...shift, breakMinutes: Number(e.target.value) || 0 })}
                className={`${inputCls} w-20`}
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {total.toLocaleString('vi-VN')} dòng dữ liệu
            {template === 'machine' && machineReport && ` • tối đa ${machineReport.maxPunches} lần chấm/ngày`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExcel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-500/20 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {/* Bảng */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            {template === 'machine' ? 'Báo cáo chấm công chi tiết theo máy' : 'Báo cáo chấm công chi tiết'}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        <div className="overflow-x-auto max-h-[65vh]">
          {template === 'machine' && machineReport && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-emerald-700 text-white">
                <tr>
                  <th className={thCls}>Mã NV</th>
                  <th className={`${thCls} text-left`}>Tên NV</th>
                  <th className={thCls}>Ngày</th>
                  <th className={thCls}>Máy</th>
                  {Array.from({ length: machineReport.maxPunches }, (_, i) => (
                    <th key={i} className={thCls}>
                      Lần {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {machineReport.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4 + machineReport.maxPunches} className="py-12 text-center text-slate-400">
                      Chưa có dữ liệu chấm công cho bộ lọc đã chọn
                    </td>
                  </tr>
                ) : (
                  pageRows(machineReport.rows).map(r => (
                    <tr key={`${r.code}|${r.date}|${r.machineId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className={`${tdCls} text-center font-mono font-bold`}>{r.code}</td>
                      <td className={`${tdCls} font-medium text-slate-900 dark:text-white`}>{r.name}</td>
                      <td className={`${tdCls} text-center`}>{formatDateVi(r.date)}</td>
                      <td className={tdCls}>{r.machineName}</td>
                      {Array.from({ length: machineReport.maxPunches }, (_, i) => (
                        <td key={i} className={`${tdCls} text-center font-mono`}>
                          {r.punches[i] || <span className="text-slate-300 dark:text-slate-700">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {template === 'daily' && dailyReport && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-emerald-700 text-white">
                <tr>
                  {[
                    'STT',
                    'Mã NV',
                    'Họ và tên',
                    'Phòng ban',
                    'Ngày',
                    'Vào sớm nhất (MIN)',
                    'Ra muộn nhất (MAX)',
                    'Mã ca',
                    'Giờ vào chuẩn',
                    'Giờ ra chuẩn',
                    'Phút vào trễ',
                    'Phút về sớm',
                    'Giờ công'
                  ].map(h => (
                    <th key={h} className={thCls}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dailyReport.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      Chưa có dữ liệu chấm công cho bộ lọc đã chọn
                    </td>
                  </tr>
                ) : (
                  pageRows(dailyReport).map(r => (
                    <tr key={`${r.code}|${r.date}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className={`${tdCls} text-center text-slate-500`}>{r.stt}</td>
                      <td className={`${tdCls} text-center font-mono font-bold`}>{r.code}</td>
                      <td className={`${tdCls} font-medium text-slate-900 dark:text-white`}>{r.name}</td>
                      <td className={tdCls}>{r.department}</td>
                      <td className={`${tdCls} text-center`}>{formatDateVi(r.date)}</td>
                      <td className={`${tdCls} text-center font-mono`}>{r.firstIn}</td>
                      <td className={`${tdCls} text-center font-mono`}>
                        {r.lastOut || <span className="text-amber-600 dark:text-amber-400">{r.note}</span>}
                      </td>
                      <td className={`${tdCls} text-center`}>{r.shiftCode}</td>
                      <td className={`${tdCls} text-center font-mono`}>{r.stdIn}</td>
                      <td className={`${tdCls} text-center font-mono`}>{r.stdOut}</td>
                      <td
                        className={`${tdCls} text-center font-bold ${
                          r.lateMinutes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {r.lateMinutes}
                      </td>
                      <td
                        className={`${tdCls} text-center font-bold ${
                          r.earlyMinutes > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'
                        }`}
                      >
                        {r.earlyMinutes}
                      </td>
                      <td className={`${tdCls} text-center font-bold text-emerald-600 dark:text-emerald-400`}>
                        {r.workHours.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Trang {page}/{pageCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pageCount}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
