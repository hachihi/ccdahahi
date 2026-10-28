import React, { useMemo, useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, Download, Calendar, Search, Cpu, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReportTable, exportCsv, exportPdf, exportXlsx } from '../services/reportExport';
import {
  ReportFilter,
  buildDailyDetailReport,
  buildMachineDetailReport,
  buildPayrollReport,
  formatDateVi
} from '../services/timesheetReportService';
import { WorkConfig } from '../services/workConfig';
import { todayVN } from '../services/timeUtils';
import { AttendanceLog, ConnectionSettings, DahahiMachine, Employee } from '../types/dahahi';

export type TemplateId = 'machine' | 'daily' | 'payroll';

interface Props {
  template: TemplateId;
  logs: AttendanceLog[];
  employees: Employee[];
  machines: DahahiMachine[];
  settings: ConnectionSettings;
  config: WorkConfig;
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
  config,
  showToast
}) => {
  const [month, setMonth] = useState(todayVN().slice(0, 7));
  const [machineId, setMachineId] = useState('all');
  const [department, setDepartment] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [dedupeSeconds, setDedupeSeconds] = useState(60);
  const [page, setPage] = useState(1);
  const [company, setCompany] = useState(() => {
    try {
      return localStorage.getItem('report_company') || '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('report_company', company);
    } catch {
      /* bỏ qua nếu trình duyệt chặn lưu */
    }
  }, [company]);
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
    () => (template === 'daily' ? buildDailyDetailReport(logs, employees, filter, config) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, logs, employees, config, month, machineId, department, keyword, dedupeSeconds]
  );
  const payrollReport = useMemo(
    () => (template === 'payroll' ? buildPayrollReport(logs, employees, filter, config) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, logs, employees, config, month, department, keyword, dedupeSeconds]
  );

  const payrollSummary = useMemo(() => {
    const rows = payrollReport || [];
    return {
      unconfirmed: rows.reduce((a, r) => a + r.unconfirmedDays, 0),
      incomplete: rows.reduce((a, r) => a + r.incompleteDays, 0),
      people: rows.filter(r => r.unconfirmedDays + r.incompleteDays > 0).length
    };
  }, [payrollReport]);

  const total =
    template === 'machine'
      ? machineReport!.rows.length
      : template === 'daily'
        ? dailyReport!.length
        : payrollReport!.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  const machineLabel =
    machineId === 'all' ? 'Tất cả máy' : machines.find(m => m.MachineBoxId === machineId)?.MachineName || machineId;
  const deptLabel = department === 'all' ? 'Tất cả phòng ban' : department;
  const subtitle =
    template === 'payroll'
      ? `Tháng ${month.slice(5)}/${month.slice(0, 4)}  |  Mọi máy  |  ${deptLabel}`
      : `Tháng ${month.slice(5)}/${month.slice(0, 4)}  |  ${machineLabel}  |  ${deptLabel}`;

  /* ---------------------- Xuất file ---------------------- */
  const buildTable = (): ReportTable => {
    if (template === 'machine') {
      const { rows, maxPunches } = machineReport!;
      return {
        company,
        title: 'BÁO CÁO CHẤM CÔNG CHI TIẾT THEO MÁY',
        subtitle,
        fileName: `bao_cao_cham_cong_theo_may_${month}`,
        columns: [
          { header: 'Mã NV', width: 12 },
          { header: 'Tên NV', width: 28, align: 'left' },
          { header: 'Ngày', width: 13 },
          { header: 'Máy', width: 22, align: 'left' },
          ...Array.from({ length: maxPunches }, (_, i) => ({ header: `Lần ${i + 1}`, width: 11 }))
        ],
        rows: rows.map(r => [
          r.code,
          r.name,
          formatDateVi(r.date),
          r.machineName,
          ...Array.from({ length: maxPunches }, (_, i) => r.punches[i] || '')
        ]),
        signatures: ['Người lập biểu', 'Kế toán', 'Giám đốc']
      };
    }
    if (template === 'payroll') {
      const pr = payrollReport!;
      const add = (f: (r: (typeof pr)[number]) => number) =>
        Math.round(pr.reduce((a, r) => a + f(r), 0) * 100) / 100;
      return {
        company,
        title: 'BẢNG TỔNG HỢP CÔNG PHỤC VỤ TÍNH LƯƠNG',
        subtitle,
        fileName: `tong_hop_cong_tinh_luong_${month}`,
        columns: [
          { header: 'STT', width: 6 },
          { header: 'Mã NV', width: 11 },
          { header: 'Họ và tên', width: 26, align: 'left' },
          { header: 'Phòng ban', width: 16, align: 'left' },
          { header: 'Mã ca', width: 7 },
          { header: 'Công chuẩn', width: 9 },
          { header: 'Công thực tế', width: 9 },
          { header: 'Công phép', width: 9 },
          { header: 'Công lễ', width: 8 },
          { header: 'Tổng công hưởng lương', width: 12 },
          { header: 'Nghỉ không lương (ngày)', width: 11 },
          { header: 'Ngày chưa có dữ liệu', width: 11 },
          { header: 'Ngày thiếu lượt chấm', width: 11 },
          { header: 'Phút đi muộn', width: 9 },
          { header: 'Phút về sớm', width: 9 },
          { header: 'TC ngày thường (giờ)', width: 11 },
          { header: 'TC ngày nghỉ (giờ)', width: 11 },
          { header: 'TC ngày lễ (giờ)', width: 11 }
        ],
        rows: pr.map(r => [
          r.stt, r.code, r.name, r.department, r.shiftCode,
          r.standardDays, r.actual, r.leavePaid, r.holidayPaid, r.paidTotal,
          r.unpaidDays, r.unconfirmedDays, r.incompleteDays, r.lateMin, r.earlyMin,
          r.otWeekday, r.otOff, r.otHoliday
        ]),
        totalsRow: [
          '', '', 'TỔNG CỘNG', '', '', '',
          add(r => r.actual), add(r => r.leavePaid), add(r => r.holidayPaid), add(r => r.paidTotal),
          add(r => r.unpaidDays), add(r => r.unconfirmedDays), add(r => r.incompleteDays),
          add(r => r.lateMin), add(r => r.earlyMin),
          add(r => r.otWeekday), add(r => r.otOff), add(r => r.otHoliday)
        ],
        signatures: ['Người lập biểu', 'Kế toán', 'Giám đốc']
      };
    }
    const rows = dailyReport!;
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    return {
      company,
      title: 'BÁO CÁO CHẤM CÔNG CHI TIẾT',
      subtitle,
      fileName: `bao_cao_cham_cong_chi_tiet_${month}`,
      columns: [
        { header: 'STT', width: 6 },
        { header: 'Mã NV', width: 12 },
        { header: 'Họ và tên', width: 28, align: 'left' },
        { header: 'Phòng ban', width: 18, align: 'left' },
        { header: 'Ngày', width: 13 },
        { header: 'Vào sớm nhất (MIN)', width: 13 },
        { header: 'Ra muộn nhất (MAX)', width: 13 },
        { header: 'Mã ca', width: 8 },
        { header: 'Giờ vào chuẩn', width: 11 },
        { header: 'Giờ ra chuẩn', width: 11 },
        { header: 'Phút vào trễ', width: 10 },
        { header: 'Phút về sớm', width: 10 },
        { header: 'Giờ công', width: 10 },
        { header: 'Ghi chú', width: 18, align: 'left' }
      ],
      rows: rows.map(r => [
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
        r.workHours, // giữ là số để Excel cộng/lọc được
        r.note
      ]),
      totalsRow: [
        '', '', 'TỔNG CỘNG', '', '', '', '', '', '', '',
        sum(r => r.lateMinutes),
        sum(r => r.earlyMinutes),
        Math.round(sum(r => r.workHours) * 100) / 100,
        ''
      ],
      signatures: ['Người lập biểu', 'Kế toán', 'Giám đốc']
    };
  };

  const runExport = async (kind: 'xlsx' | 'pdf' | 'csv') => {
    const t = buildTable();
    if (t.rows.length === 0) {
      showToast('Chưa có dữ liệu để xuất. Hãy kiểm tra lại tháng hoặc bộ lọc.', 'error');
      return;
    }
    try {
      setBusy(true);
      if (kind === 'xlsx') {
        await exportXlsx(t);
        showToast(`Đã xuất ${t.rows.length} dòng ra Excel (.xlsx)`, 'success');
      } else if (kind === 'csv') {
        exportCsv(t);
        showToast(`Đã xuất ${t.rows.length} dòng ra CSV`, 'success');
      } else if (exportPdf(t)) {
        showToast('Đã mở cửa sổ in. Chọn "Lưu dạng PDF" để lưu file.', 'info');
      } else {
        showToast('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Xuất file không thành công. Vui lòng thử lại.', 'error');
    } finally {
      setBusy(false);
    }
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

          {template !== 'payroll' && (
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
          )}

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
            Tên đơn vị
            <input
              type="text"
              placeholder="In ở đầu báo cáo"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className={`${inputCls} w-48`}
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

        {(template === 'daily' || template === 'payroll') && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p>
              <b>Ca làm việc, ngày nghỉ, ngày lễ, nghỉ phép</b> lấy từ tab <b>Cấu hình ca &amp; lịch làm việc</b>. Hiện có{' '}
              {config.shifts.length} ca, {config.holidays.length} ngày lễ, {config.leaves.length} lượt nghỉ phép.
              {template === 'payroll' && !config.rules.otEnabled && ' Tính tăng ca đang tắt.'}
            </p>
            {template === 'payroll' && payrollReport && payrollSummary.unconfirmed + payrollSummary.incomplete > 0 && (
              <p className="text-amber-700 dark:text-amber-400 font-semibold">
                Cần kiểm tra trước khi chốt: {payrollSummary.unconfirmed} ngày làm việc chưa có dữ liệu chấm công và{' '}
                {payrollSummary.incomplete} ngày chỉ có 1 lượt chấm, thuộc {payrollSummary.people} nhân viên. Những ngày này
                chưa được tính công và chưa kết luận là vắng mặt. Hãy đối chiếu với nghỉ phép, đi công tác hoặc lỗi máy.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {total.toLocaleString('vi-VN')} dòng dữ liệu
            {template === 'machine' && machineReport && ` • tối đa ${machineReport.maxPunches} lần chấm/ngày`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runExport('csv')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => runExport('pdf')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              In / Xuất PDF
            </button>
            <button
              onClick={() => runExport('xlsx')}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {busy ? 'Đang xuất…' : 'Xuất Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Bảng */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            {template === 'machine'
              ? 'Mẫu 6: Nhật ký chấm công theo máy'
              : template === 'daily'
                ? 'Mẫu 2: Báo cáo chấm công chi tiết'
                : 'Mẫu 5: Tổng hợp công phục vụ tính lương'}
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

          {template === 'payroll' && payrollReport && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-emerald-700 text-white">
                <tr>
                  {[
                    'STT', 'Mã NV', 'Họ và tên', 'Phòng ban', 'Mã ca', 'Công chuẩn', 'Công thực tế', 'Công phép',
                    'Công lễ', 'Tổng công hưởng lương', 'Nghỉ không lương', 'Ngày chưa có dữ liệu',
                    'Ngày thiếu lượt chấm', 'Phút đi muộn', 'Phút về sớm', 'TC ngày thường (giờ)',
                    'TC ngày nghỉ (giờ)', 'TC ngày lễ (giờ)'
                  ].map(h => (
                    <th key={h} className={`${thCls} whitespace-normal min-w-[64px]`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payrollReport.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="py-12 text-center text-slate-400">
                      Chưa có nhân viên hoặc dữ liệu cho tháng này. Hãy đồng bộ dữ liệu từ máy chấm công rồi thử lại.
                    </td>
                  </tr>
                ) : (
                  pageRows(payrollReport).map(r => (
                    <tr key={r.pid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className={`${tdCls} text-center text-slate-500`}>{r.stt}</td>
                      <td className={`${tdCls} text-center font-mono font-bold`}>{r.code}</td>
                      <td className={`${tdCls} font-medium text-slate-900 dark:text-white`}>{r.name}</td>
                      <td className={tdCls}>{r.department}</td>
                      <td className={`${tdCls} text-center`}>{r.shiftCode}</td>
                      <td className={`${tdCls} text-center`}>{r.standardDays}</td>
                      <td className={`${tdCls} text-center font-bold`}>{r.actual}</td>
                      <td className={`${tdCls} text-center`}>{r.leavePaid}</td>
                      <td className={`${tdCls} text-center`}>{r.holidayPaid}</td>
                      <td className={`${tdCls} text-center font-bold text-emerald-600 dark:text-emerald-400`}>{r.paidTotal}</td>
                      <td className={`${tdCls} text-center`}>{r.unpaidDays}</td>
                      <td className={`${tdCls} text-center font-bold ${r.unconfirmedDays > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                        {r.unconfirmedDays}
                      </td>
                      <td className={`${tdCls} text-center font-bold ${r.incompleteDays > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                        {r.incompleteDays}
                      </td>
                      <td className={`${tdCls} text-center ${r.lateMin > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'}`}>{r.lateMin}</td>
                      <td className={`${tdCls} text-center ${r.earlyMin > 0 ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-slate-400'}`}>{r.earlyMin}</td>
                      <td className={`${tdCls} text-center`}>{r.otWeekday}</td>
                      <td className={`${tdCls} text-center`}>{r.otOff}</td>
                      <td className={`${tdCls} text-center`}>{r.otHoliday}</td>
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
