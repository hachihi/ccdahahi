import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Settings
} from 'lucide-react';
import { DahahiDataService, downloadCsv, pad2 } from '../services/dahahiService';
import { ConnectionSettings, AttendanceLog, Employee, DahahiMachine } from '../types/dahahi';
import { TimesheetTemplatesView } from './TimesheetTemplatesView';

interface MonthlyReportViewProps {
  logs: AttendanceLog[];
  employees: Employee[];
  machines?: DahahiMachine[];
  settings: ConnectionSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  logs,
  employees,
  machines = [],
  settings,
  showToast
}) => {
  const [reportMode, setReportMode] = useState<'matrix' | 'machine' | 'daily'>('matrix');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [workStartTime, setWorkStartTime] = useState<string>(settings.workStartTime || '08:30');

  // Days in month calculation (28 - 31)
  const [yearStr, monthStr] = selectedMonth.split('-');
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => pad2(i + 1));

  // Compute report data from real logs & employees
  const reportRows = DahahiDataService.calculateMonthlyReport(logs, employees, selectedMonth, workStartTime);

  // Totals
  const totalWorkDays = reportRows.reduce((sum, r) => sum + r.workDays, 0);
  const totalHours = reportRows.reduce((sum, r) => sum + r.hours, 0);
  const totalLate = reportRows.reduce((sum, r) => sum + r.late, 0);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Mã NV',
      'Họ và tên',
      'Phòng ban',
      'Số ngày công',
      'Tổng giờ làm',
      'Số lần đi muộn',
      ...dayNumbers.map(d => `Ngày ${+d}`)
    ];

    const rows = reportRows.map(r => [
      r.pid,
      r.name,
      r.department || '',
      r.workDays,
      r.hours,
      r.late,
      ...dayNumbers.map(d => (r.days[d] ? r.days[d].join(' - ') : ''))
    ]);

    downloadCsv(`bang_tong_hop_cong_${selectedMonth}.csv`, headers, rows);
    showToast(`Đã xuất bảng công tháng ${selectedMonth} ra tệp CSV`, 'success');
  };

  const modeTabs: { id: 'matrix' | 'machine' | 'daily'; label: string }[] = [
    { id: 'matrix', label: 'Bảng công tổng hợp' },
    { id: 'machine', label: 'Mẫu 1: Chi tiết theo máy' },
    { id: 'daily', label: 'Mẫu 2: Chấm công chi tiết' }
  ];

  const modeBar = (
    <div className="flex flex-wrap gap-2">
      {modeTabs.map(t => (
        <button
          key={t.id}
          onClick={() => setReportMode(t.id)}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition ${
            reportMode === t.id
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  if (reportMode !== 'matrix') {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {modeBar}
        <TimesheetTemplatesView
          template={reportMode}
          logs={logs}
          employees={employees}
          machines={machines}
          settings={settings}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {modeBar}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chọn tháng:
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Giờ chuẩn vào ca:
            </span>
            <input
              type="time"
              value={workStartTime}
              onChange={e => setWorkStartTime(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-500/20 transition"
        >
          <Download className="w-4 h-4" />
          Xuất Bảng công (CSV)
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng lượt ngày công</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{totalWorkDays} công</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng số giờ làm việc</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{totalHours.toFixed(1)} giờ</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Số lượt đi muộn (&gt;{workStartTime})</p>
            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{totalLate} lượt</p>
          </div>
        </div>
      </div>

      {/* Timesheet Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Chi tiết bảng chấm công tháng {selectedMonth}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Hiển thị giờ vào đầu ngày và giờ ra cuối ngày cho từng nhân sự
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500" />
              Đúng giờ
            </span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500" />
              Đi muộn
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 py-3 pl-4 pr-3 min-w-[70px]">
                  Mã NV
                </th>
                <th className="sticky left-[70px] z-30 bg-slate-100 dark:bg-slate-800 py-3 px-3 min-w-[150px]">
                  Họ và tên
                </th>
                <th className="py-3 px-2 text-center min-w-[55px]">Công</th>
                <th className="py-3 px-2 text-center min-w-[55px]">Giờ</th>
                <th className="py-3 px-2 text-center min-w-[55px]">Muộn</th>
                {dayNumbers.map(d => (
                  <th key={d} className="py-3 px-1.5 text-center min-w-[68px] font-mono">
                    {+d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={5 + daysInMonth} className="py-12 text-center text-slate-400">
                    Chưa có dữ liệu chấm công cho tháng {selectedMonth}
                  </td>
                </tr>
              ) : (
                reportRows.map(row => (
                  <tr
                    key={row.pid}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                  >
                    {/* Fixed PID */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800 py-2.5 pl-4 pr-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {row.pid}
                    </td>

                    {/* Fixed Name */}
                    <td className="sticky left-[70px] z-10 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800 py-2.5 px-3 font-medium text-slate-900 dark:text-white truncate">
                      {row.name}
                    </td>

                    {/* Work Days */}
                    <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {row.workDays}
                    </td>

                    {/* Hours */}
                    <td className="py-2.5 px-2 text-center font-medium text-slate-700 dark:text-slate-300">
                      {row.hours}
                    </td>

                    {/* Late */}
                    <td
                      className={`py-2.5 px-2 text-center font-bold ${
                        row.late > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {row.late}
                    </td>

                    {/* Days 1-31 */}
                    {dayNumbers.map(d => {
                      const dayData = row.days[d];
                      if (!dayData) {
                        return (
                          <td
                            key={d}
                            className="py-2.5 px-1 text-center font-mono text-slate-300 dark:text-slate-700 select-none"
                          >
                            —
                          </td>
                        );
                      }
                      const [inTime, outTime] = dayData;
                      const isLate = inTime > workStartTime;

                      return (
                        <td
                          key={d}
                          className="py-1 px-1 text-center font-mono text-[10px] leading-tight"
                        >
                          <div
                            className={`p-1 rounded-md border ${
                              isLate
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                            }`}
                          >
                            <span className="font-semibold block">{inTime}</span>
                            {outTime !== inTime && (
                              <span className="text-slate-500 dark:text-slate-400 block border-t border-slate-200 dark:border-slate-800/80 mt-0.5 pt-0.5">
                                {outTime}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
