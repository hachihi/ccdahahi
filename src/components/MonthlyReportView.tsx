import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Printer,
  SlidersHorizontal,
  HardDrive,
  Building2,
  Search,
  Layers,
  ArrowUpDown,
  FileText
} from 'lucide-react';
import { HachihiDataService, downloadCsv, pad2 } from '../services/hachihiService';
import { ConnectionSettings, AttendanceLog, Employee, HachihiMachine } from '../types/hachihi';

export type ReportTemplate = 'device_detail' | 'shift_detail' | 'monthly_matrix';

interface MonthlyReportViewProps {
  logs: AttendanceLog[];
  employees: Employee[];
  machines?: HachihiMachine[];
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate>('device_detail');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchEmployee, setSearchEmployee] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Shift settings
  const [shiftCode, setShiftCode] = useState<string>('HC');
  const [standardIn, setStandardIn] = useState<string>(settings.workStartTime || '08:00');
  const [standardOut, setStandardOut] = useState<string>(settings.workEndTime || '17:00');
  const [showShiftConfig, setShowShiftConfig] = useState<boolean>(false);

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department?.trim()) set.add(e.department.trim());
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees by search
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch =
        !searchEmployee.trim() ||
        e.name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
        e.id.includes(searchEmployee) ||
        (e.code && e.code.toLowerCase().includes(searchEmployee.toLowerCase()));
      const matchDept = selectedDept === 'all' || e.department === selectedDept;
      return matchSearch && matchDept;
    });
  }, [employees, searchEmployee, selectedDept]);

  // 1. Data for Mẫu 1: Chi tiết theo máy (cứ mỗi lần chấm là thêm 1 cột)
  const deviceDetailReport = useMemo(() => {
    const filteredLogs = logs.filter(l => {
      if (searchEmployee.trim()) {
        const emp = employees.find(e => e.id === l.pid);
        const nameMatch = (emp?.name || l.name || '').toLowerCase().includes(searchEmployee.toLowerCase());
        const codeMatch = (emp?.code || l.pid).toLowerCase().includes(searchEmployee.toLowerCase());
        if (!nameMatch && !codeMatch) return false;
      }
      return true;
    });

    return HachihiDataService.calculateDeviceDetailReport(filteredLogs, employees, machines, {
      monthStr: selectedDate ? undefined : selectedMonth,
      dateStr: selectedDate || undefined,
      machineBoxId: selectedMachine !== 'all' ? selectedMachine : undefined
    });
  }, [logs, employees, machines, selectedMonth, selectedDate, selectedMachine, searchEmployee]);

  // 2. Data for Mẫu 2: Báo cáo chấm công chi tiết theo ca
  const shiftDetailReport = useMemo(() => {
    const filteredLogs = logs.filter(l => {
      if (searchEmployee.trim()) {
        const emp = employees.find(e => e.id === l.pid);
        const nameMatch = (emp?.name || l.name || '').toLowerCase().includes(searchEmployee.toLowerCase());
        const codeMatch = (emp?.code || l.pid).toLowerCase().includes(searchEmployee.toLowerCase());
        if (!nameMatch && !codeMatch) return false;
      }
      return true;
    });

    return HachihiDataService.calculateDetailedShiftReport(filteredLogs, employees, {
      monthStr: selectedDate ? undefined : selectedMonth,
      dateStr: selectedDate || undefined,
      standardIn,
      standardOut,
      shiftCode,
      department: selectedDept !== 'all' ? selectedDept : undefined
    });
  }, [logs, employees, selectedMonth, selectedDate, standardIn, standardOut, shiftCode, selectedDept, searchEmployee]);

  // 3. Data for Mẫu 3: Bảng ma trận tổng hợp tháng
  const [yearStr, monthStr] = selectedMonth.split('-');
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => pad2(i + 1));
  const matrixReportRows = useMemo(() => {
    return HachihiDataService.calculateMonthlyReport(logs, filteredEmployees, selectedMonth, standardIn);
  }, [logs, filteredEmployees, selectedMonth, standardIn]);

  // Totals for Mẫu 2
  const shiftTotals = useMemo(() => {
    let totalLateMins = 0;
    let totalEarlyMins = 0;
    let totalWorkHours = 0;
    let lateCount = 0;
    let earlyCount = 0;

    shiftDetailReport.forEach(r => {
      if (r.lateMinutes > 0) {
        totalLateMins += r.lateMinutes;
        lateCount++;
      }
      if (r.earlyMinutes > 0) {
        totalEarlyMins += r.earlyMinutes;
        earlyCount++;
      }
      totalWorkHours += r.workHours;
    });

    return {
      totalRows: shiftDetailReport.length,
      totalLateMins,
      totalEarlyMins,
      lateCount,
      earlyCount,
      totalWorkHours: +(totalWorkHours.toFixed(1))
    };
  }, [shiftDetailReport]);

  // Totals for Mẫu 3
  const matrixTotals = useMemo(() => {
    const totalWorkDays = matrixReportRows.reduce((sum, r) => sum + r.workDays, 0);
    const totalHours = matrixReportRows.reduce((sum, r) => sum + r.hours, 0);
    const totalLate = matrixReportRows.reduce((sum, r) => sum + r.late, 0);
    return { totalWorkDays, totalHours, totalLate };
  }, [matrixReportRows]);

  // Export CSV handler matching current template
  const handleExportCsv = () => {
    if (activeTemplate === 'device_detail') {
      const { rows, maxPunches } = deviceDetailReport;
      const punchHeaders = Array.from({ length: maxPunches }, (_, i) => `Lần ${i + 1}`);
      const headers = ['Mã NV', 'Tên NV', 'Ngày', 'Máy', ...punchHeaders];
      const dataRows = rows.map(r => [
        r.employeeCode,
        r.employeeName,
        r.date,
        r.machine,
        ...Array.from({ length: maxPunches }, (_, i) => r.punches[i] || '')
      ]);
      const dateTag = selectedDate || selectedMonth;
      downloadCsv(`bao_cao_chi_tiet_theo_may_${dateTag}.csv`, headers, dataRows);
      showToast(`Đã xuất Mẫu 1: Chi tiết theo máy (${rows.length} dòng)`, 'success');
      return;
    }

    if (activeTemplate === 'shift_detail') {
      const headers = [
        'STT',
        'Mã NV',
        'Họ và tên',
        'Phòng ban',
        'Ngày',
        'Vào Sớm Nhất (MIN)',
        'Ra Muộn Nhất (MAX)',
        'Mã Ca',
        'Giờ Vào Chuẩn',
        'Giờ Ra Chuẩn',
        'Phút vào Trễ',
        'Phút về Sớm',
        'Giờ công'
      ];
      const dataRows = shiftDetailReport.map(r => [
        r.stt,
        r.employeeCode,
        r.employeeName,
        r.department,
        r.date,
        r.minIn,
        r.maxOut,
        r.shiftCode,
        r.standardIn,
        r.standardOut,
        r.lateMinutes,
        r.earlyMinutes,
        r.workHours
      ]);
      const dateTag = selectedDate || selectedMonth;
      downloadCsv(`bao_cao_cham_cong_chi_tiet_ca_${dateTag}.csv`, headers, dataRows);
      showToast(`Đã xuất Mẫu 2: Báo cáo chấm công chi tiết (${shiftDetailReport.length} dòng)`, 'success');
      return;
    }

    // Matrix
    const headers = [
      'Mã NV',
      'Họ và tên',
      'Phòng ban',
      'Số ngày công',
      'Tổng giờ làm',
      'Số lần đi muộn',
      ...dayNumbers.map(d => `Ngày ${+d}`)
    ];
    const dataRows = matrixReportRows.map(r => [
      r.pid,
      r.name,
      r.department || '',
      r.workDays,
      r.hours,
      r.late,
      ...dayNumbers.map(d => (r.days[d] ? r.days[d].join(' - ') : ''))
    ]);
    downloadCsv(`bang_tong_hop_cong_${selectedMonth}.csv`, headers, dataRows);
    showToast(`Đã xuất Mẫu 3: Bảng công tổng hợp tháng ${selectedMonth}`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Template Switcher Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTemplate('device_detail')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeTemplate === 'device_detail'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Mẫu 1: Chi tiết theo máy (Lần 1...N)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {deviceDetailReport.rows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTemplate('shift_detail')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeTemplate === 'shift_detail'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Mẫu 2: Báo cáo chấm công chi tiết</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {shiftDetailReport.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTemplate('monthly_matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeTemplate === 'monthly_matrix'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Mẫu 3: Tổng hợp tháng (1-31)</span>
          </button>
        </div>

        {/* Actions (Export & Print) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowShiftConfig(!showShiftConfig)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              showShiftConfig
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Tùy chỉnh thông số ca (Giờ chuẩn vào, Giờ chuẩn ra, Mã ca)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Cấu hình ca</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            title="In báo cáo (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">In báo cáo</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-500/20 transition"
          >
            <Download className="w-4 h-4" />
            Xuất Excel (CSV)
          </button>
        </div>
      </div>

      {/* Collapsible Shift Parameters Config */}
      {showShiftConfig && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900/60 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
              Thiết lập ca làm việc chuẩn áp dụng cho Mẫu 2 & Mẫu 3
            </h4>
            <span className="text-[11px] text-slate-400">
              Dùng để tính số phút vào trễ, phút về sớm và số giờ công
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Mã Ca làm việc
              </label>
              <input
                type="text"
                value={shiftCode}
                onChange={e => setShiftCode(e.target.value.toUpperCase())}
                placeholder="Ví dụ: HC, CA1, CA2"
                className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Giờ Vào Chuẩn (Start Time)
              </label>
              <input
                type="time"
                value={standardIn}
                onChange={e => setStandardIn(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Giờ Ra Chuẩn (End Time)
              </label>
              <input
                type="time"
                value={standardOut}
                onChange={e => setStandardOut(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month picker */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tháng:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => {
                setSelectedMonth(e.target.value);
                setSelectedDate('');
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Specific date picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Hoặc ngày cụ thể:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-[11px] text-slate-400 hover:text-rose-500 underline"
              >
                Cả tháng
              </button>
            )}
          </div>

          {/* Machine filter (for Mẫu 1) */}
          {activeTemplate === 'device_detail' && (
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedMachine}
                onChange={e => setSelectedMachine(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">Tất cả các máy chấm công</option>
                {machines.map(m => (
                  <option key={m.MachineBoxId} value={m.MachineBoxId}>
                    {m.MachineName} ({m.MachineBoxId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department filter (for Mẫu 2 & 3) */}
          {activeTemplate !== 'device_detail' && departments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search employee by name / code */}
        <div className="relative min-w-[200px] w-full sm:w-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchEmployee}
            onChange={e => setSearchEmployee(e.target.value)}
            placeholder="Tìm theo tên hoặc mã NV..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Summary KPI Cards depending on Active Template */}
      {activeTemplate === 'device_detail' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng dòng ghi nhận</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                {deviceDetailReport.rows.length} lượt
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cột chấm nhiều nhất</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                {deviceDetailReport.maxPunches} lần / ngày
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Số nhân sự có dữ liệu</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                {new Set(deviceDetailReport.rows.map(r => r.employeeCode)).size} người
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Số thiết bị hoạt động</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                {new Set(deviceDetailReport.rows.map(r => r.machine)).size} máy
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTemplate === 'shift_detail' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng số lượt công</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                {shiftTotals.totalRows} ca
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng giờ công thực tế</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {shiftTotals.totalWorkHours} giờ
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng phút vào trễ</p>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {shiftTotals.totalLateMins} phút ({shiftTotals.lateCount} ca)
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng phút về sớm</p>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {shiftTotals.totalEarlyMins} phút ({shiftTotals.earlyCount} ca)
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTemplate === 'monthly_matrix' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng lượt ngày công</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{matrixTotals.totalWorkDays} công</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng số giờ làm việc</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{matrixTotals.totalHours.toFixed(1)} giờ</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Số lượt đi muộn (&gt;{standardIn})</p>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{matrixTotals.totalLate} lượt</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container with Print Styling */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Table Title and Legend */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              {activeTemplate === 'device_detail' && <HardDrive className="w-4 h-4 text-emerald-500" />}
              {activeTemplate === 'shift_detail' && <FileText className="w-4 h-4 text-blue-500" />}
              {activeTemplate === 'monthly_matrix' && <FileSpreadsheet className="w-4 h-4 text-purple-500" />}
              {activeTemplate === 'device_detail' && `Mẫu 1: Báo cáo chấm công chi tiết theo máy (${selectedDate || selectedMonth})`}
              {activeTemplate === 'shift_detail' && `Mẫu 2: Báo cáo chấm công chi tiết theo ca (${selectedDate || selectedMonth})`}
              {activeTemplate === 'monthly_matrix' && `Mẫu 3: Bảng chấm công tổng hợp tháng ${selectedMonth}`}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {activeTemplate === 'device_detail' && 'Mỗi lượt quẹt mặt trên máy được tách riêng thành các cột Lần 1, Lần 2, Lần 3... theo đúng trình tự thời gian.'}
              {activeTemplate === 'shift_detail' && `Đầy đủ các trường: STT, Mã NV, Họ tên, Phòng ban, Ngày, Vào MIN, Ra MAX, Mã ca (${shiftCode}), Vào chuẩn (${standardIn}), Ra chuẩn (${standardOut}), Phút trễ, Phút sớm, Giờ công.`}
              {activeTemplate === 'monthly_matrix' && 'Hiển thị giờ vào đầu ngày và giờ ra cuối ngày cho từng nhân viên từ ngày 1 đến cuối tháng.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            {activeTemplate === 'shift_detail' && (
              <>
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Đúng giờ
                </span>
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Vào trễ
                </span>
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Về sớm
                </span>
              </>
            )}
          </div>
        </div>

        {/* ======================= MẪU 1: CHI TIẾT THEO MÁY ======================= */}
        {activeTemplate === 'device_detail' && (
          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 pl-4 pr-3 min-w-[90px] font-bold">Mã NV</th>
                  <th className="py-3 px-3 min-w-[150px] font-bold">Tên NV</th>
                  <th className="py-3 px-3 min-w-[100px] text-center font-bold">Ngày</th>
                  <th className="py-3 px-3 min-w-[180px] font-bold">Máy</th>
                  {Array.from({ length: deviceDetailReport.maxPunches }, (_, i) => (
                    <th key={i} className="py-3 px-3 text-center min-w-[90px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 border-l border-slate-200 dark:border-slate-700">
                      Lần {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {deviceDetailReport.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4 + deviceDetailReport.maxPunches} className="py-12 text-center text-slate-400 font-sans">
                      Không tìm thấy dữ liệu chấm công theo máy trong khoảng thời gian đã chọn
                    </td>
                  </tr>
                ) : (
                  deviceDetailReport.rows.map((row, idx) => (
                    <tr key={`${row.employeeCode}-${row.date}-${row.machine}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 pl-4 pr-3 font-bold text-slate-900 dark:text-white">
                        {row.employeeCode}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                        {row.employeeName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px]">
                          <HardDrive className="w-3 h-3 text-emerald-500" />
                          {row.machine}
                        </span>
                      </td>
                      {Array.from({ length: deviceDetailReport.maxPunches }, (_, i) => {
                        const punch = row.punches[i];
                        return (
                          <td key={i} className="py-2.5 px-3 text-center border-l border-slate-100 dark:border-slate-800">
                            {punch ? (
                              <span className="inline-block px-2 py-0.5 rounded font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {punch}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 select-none">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ======================= MẪU 2: BÁO CÁO CHẤM CÔNG CHI TIẾT THEO CA ======================= */}
        {activeTemplate === 'shift_detail' && (
          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 pl-3 pr-2 text-center w-[50px]">STT</th>
                  <th className="py-3 px-2 min-w-[80px]">Mã NV</th>
                  <th className="py-3 px-3 min-w-[150px]">Họ và tên</th>
                  <th className="py-3 px-2 min-w-[110px]">Phòng ban</th>
                  <th className="py-3 px-2 text-center min-w-[90px]">Ngày</th>
                  <th className="py-3 px-2 text-center min-w-[95px] text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                    Vào Sớm Nhất (MIN)
                  </th>
                  <th className="py-3 px-2 text-center min-w-[95px] text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20">
                    Ra Muộn Nhất (MAX)
                  </th>
                  <th className="py-3 px-2 text-center min-w-[65px]">Mã Ca</th>
                  <th className="py-3 px-2 text-center min-w-[85px]">Giờ Vào Chuẩn</th>
                  <th className="py-3 px-2 text-center min-w-[85px]">Giờ Ra Chuẩn</th>
                  <th className="py-3 px-2 text-center min-w-[85px] text-rose-600 dark:text-rose-400">Phút vào Trễ</th>
                  <th className="py-3 px-2 text-center min-w-[85px] text-amber-600 dark:text-amber-400">Phút về Sớm</th>
                  <th className="py-3 pr-3 pl-2 text-center min-w-[80px] font-bold text-emerald-600 dark:text-emerald-400">
                    Giờ công
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {shiftDetailReport.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 font-sans">
                      Chưa có dữ liệu chấm công chi tiết theo ca trong thời gian này
                    </td>
                  </tr>
                ) : (
                  shiftDetailReport.map((row) => (
                    <tr key={`${row.stt}-${row.employeeCode}-${row.date}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 pl-3 pr-2 text-center text-slate-500 font-sans">
                        {row.stt}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">
                        {row.employeeCode}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                        {row.employeeName}
                      </td>
                      <td className="py-2.5 px-2 font-sans text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                        {row.department}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-2 text-center bg-emerald-50/30 dark:bg-emerald-950/10 font-bold text-emerald-700 dark:text-emerald-300">
                        {row.minIn}
                      </td>
                      <td className="py-2.5 px-2 text-center bg-blue-50/30 dark:bg-blue-950/10 font-bold text-blue-700 dark:text-blue-300">
                        {row.maxOut}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold font-sans text-slate-700 dark:text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                          {row.shiftCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400">
                        {row.standardIn}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400">
                        {row.standardOut}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold ${row.lateMinutes > 0 ? 'text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20' : 'text-slate-400'}`}>
                        {row.lateMinutes > 0 ? `${row.lateMinutes}p` : '0'}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold ${row.earlyMinutes > 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'text-slate-400'}`}>
                        {row.earlyMinutes > 0 ? `${row.earlyMinutes}p` : '0'}
                      </td>
                      <td className="py-2.5 pr-3 pl-2 text-center font-bold text-emerald-600 dark:text-emerald-400 font-sans">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                          {row.workHours}h
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ======================= MẪU 3: BẢNG MA TRẬN TỔNG HỢP THÁNG ======================= */}
        {activeTemplate === 'monthly_matrix' && (
          <div className="overflow-x-auto max-h-[72vh]">
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
                {matrixReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={5 + daysInMonth} className="py-12 text-center text-slate-400 font-sans">
                      Chưa có dữ liệu chấm công cho tháng {selectedMonth}
                    </td>
                  </tr>
                ) : (
                  matrixReportRows.map(row => (
                    <tr
                      key={row.pid}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                    >
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800 py-2.5 pl-4 pr-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {row.pid}
                      </td>
                      <td className="sticky left-[70px] z-10 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800 py-2.5 px-3 font-medium text-slate-900 dark:text-white truncate">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {row.workDays}
                      </td>
                      <td className="py-2.5 px-2 text-center font-medium text-slate-700 dark:text-slate-300">
                        {row.hours}
                      </td>
                      <td
                        className={`py-2.5 px-2 text-center font-bold ${
                          row.late > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {row.late}
                      </td>
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
                        const isLate = inTime > standardIn;

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
        )}
      </div>
    </div>
  );
};
