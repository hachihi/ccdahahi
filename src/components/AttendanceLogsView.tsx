import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  HardDrive,
  Search,
  Download,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileSpreadsheet,
  Building2,
  Briefcase,
  Users,
  RotateCcw,
  X
} from 'lucide-react';
import { AttendanceLog, HachihiMachine, Employee, ConnectionSettings } from '../types/hachihi';
import { useAuth } from '../context/AuthContext';
import { HachihiDataService, downloadCsv, toHachihiTimeStr, fromHachihiTimeStr } from '../services/hachihiService';

interface AttendanceLogsViewProps {
  logs: AttendanceLog[];
  machines: HachihiMachine[];
  employees: Employee[];
  settings: ConnectionSettings;
  onRefreshData: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AttendanceLogsView: React.FC<AttendanceLogsViewProps> = ({
  logs,
  machines,
  employees,
  settings,
  onRefreshData,
  showToast
}) => {
  const { hasPermission } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = `${today.slice(0, 7)}-01`;

  const [fromDate, setFromDate] = useState(startOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [searchPid, setSearchPid] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const canSync = hasPermission('sync_data');

  // Map employees for fast O(1) lookup
  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  // Unique departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department?.trim()) set.add(e.department.trim());
    });
    return Array.from(set).sort();
  }, [employees]);

  // Unique positions / divisions list
  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.position?.trim()) set.add(e.position.trim());
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filter logs with department and position matching
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const logDate = l.time.slice(0, 10);
      const matchDate = (!fromDate || logDate >= fromDate) && (!toDate || logDate <= toDate);
      const matchMachine = selectedMachine === 'all' || l.m === selectedMachine;

      const emp = empMap.get(l.pid);
      const empDept = emp?.department?.trim() || '';
      const empPos = emp?.position?.trim() || '';

      const matchDept = selectedDepartment === 'all' || empDept === selectedDepartment;
      const matchPos = selectedPosition === 'all' || empPos === selectedPosition;

      const q = searchPid.toLowerCase().trim();
      const matchPid =
        !q ||
        l.pid.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        (emp?.code && emp.code.toLowerCase().includes(q)) ||
        empDept.toLowerCase().includes(q) ||
        empPos.toLowerCase().includes(q);

      return matchDate && matchMachine && matchDept && matchPos && matchPid;
    });
  }, [logs, fromDate, toDate, selectedMachine, selectedDepartment, selectedPosition, searchPid, empMap]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedMachine !== 'all' ||
    selectedDepartment !== 'all' ||
    selectedPosition !== 'all' ||
    Boolean(searchPid.trim()) ||
    fromDate !== startOfMonth ||
    toDate !== today;

  const handleResetFilters = () => {
    setFromDate(startOfMonth);
    setToDate(today);
    setSelectedMachine('all');
    setSelectedDepartment('all');
    setSelectedPosition('all');
    setSearchPid('');
  };

  // Sync logs from Hachihi machine via /api/facereg/checkinhis
  const handleSyncFromDevice = async () => {
    const targetMachines = selectedMachine === 'all'
      ? machines.map(m => m.MachineBoxId)
      : [selectedMachine];

    if (targetMachines.length === 0) {
      showToast('Chưa có máy chấm công nào để đồng bộ', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await HachihiDataService.syncLogsFromMachine(
        fromDate,
        toDate,
        selectedMachine !== 'all' ? selectedMachine : undefined
      );

      if (res && res.ok) {
        onRefreshData();
        showToast(res.message || `Đã đồng bộ ${res.added} lượt chấm công từ máy`, 'success');
      } else {
        showToast(res?.error || 'Lỗi khi đồng bộ lịch sử từ máy', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi đồng bộ: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export CSV with Department & Position
  const handleExportCsv = () => {
    const headers = [
      'Thời gian',
      'Mã nhân viên (ID)',
      'Mã nhân sự (Code)',
      'Họ và tên',
      'Phòng ban',
      'Bộ phận / Chức vụ',
      'Thiết bị chấm công',
      'Mã thiết bị (MachineBoxId)',
      'Thân nhiệt (°C)',
      'Trạng thái'
    ];
    const rows = filteredLogs.map(l => {
      const emp = empMap.get(l.pid);
      const mObj = machines.find(m => m.MachineBoxId === l.m);
      const timeOnly = l.time.slice(11, 16);
      const isLate = timeOnly > (settings.workStartTime || '08:30') && timeOnly < '12:00';
      return [
        l.time,
        l.pid,
        emp?.code || l.pid,
        l.name,
        emp?.department || 'Chưa phân ban',
        emp?.position || '—',
        mObj?.MachineName || l.m,
        l.m,
        l.temp || '',
        isLate ? 'Đi muộn' : 'Hợp lệ'
      ];
    });

    const deptTag = selectedDepartment !== 'all' ? `_${selectedDepartment.replace(/\s+/g, '_')}` : '';
    downloadCsv(`lich_su_cham_cong${deptTag}_${fromDate}_${toDate}.csv`, headers, rows);
    showToast(`Đã xuất ${filteredLogs.length} bản ghi chấm công ra tệp CSV`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* From Date */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Từ:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Đến:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Machine */}
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedMachine}
                onChange={e => setSelectedMachine(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tất cả máy chấm công ({machines.length})</option>
                {machines.map(m => (
                  <option key={m.MachineBoxId} value={m.MachineBoxId}>
                    {m.MachineName} ({m.MachineBoxId})
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter (Phòng ban) */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm border transition focus:ring-2 focus:ring-emerald-500 font-medium ${
                  selectedDepartment !== 'all'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-200 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                }`}
                title="Lọc dữ liệu chấm công theo Phòng ban"
              >
                <option value="all">Tất cả phòng ban ({departments.length})</option>
                {departments.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Position / Division Filter (Bộ phận / Chức vụ) */}
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <select
                value={selectedPosition}
                onChange={e => setSelectedPosition(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm border transition focus:ring-2 focus:ring-emerald-500 font-medium ${
                  selectedPosition !== 'all'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-800 dark:text-blue-200 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                }`}
                title="Lọc dữ liệu chấm công theo Bộ phận hoặc Chức vụ"
              >
                <option value="all">Tất cả chức vụ / bộ phận ({positions.length})</option>
                {positions.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Person */}
            <div className="relative min-w-[170px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchPid}
                onChange={e => setSearchPid(e.target.value)}
                placeholder="Mã, tên, phòng ban..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 transition"
                title="Đặt lại tất cả bộ lọc"
              >
                <RotateCcw className="w-3 h-3" />
                Xóa lọc
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            {settings.autoSync?.enabled && (
              <span
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80"
                title={settings.autoSync.lastSyncMessage || 'Đang tự đồng bộ định kỳ'}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Tự đồng bộ: {settings.autoSync.intervalMinutes}p/lần
              </span>
            )}

            {canSync && (
              <button
                onClick={handleSyncFromDevice}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ thiết bị'}
              </button>
            )}

            {canSync && (
              <button
                onClick={async () => {
                  const res = await HachihiDataService.deduplicateAttendance();
                  if (res.ok) {
                    onRefreshData();
                    showToast(res.message || `Đã loại bỏ ${res.removedCount} bản ghi trùng`, 'success');
                  } else {
                    showToast(res.error || 'Lỗi khi lọc trùng dữ liệu', 'error');
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm font-semibold transition"
                title="Loại bỏ các lần chấm lặp lại liên tiếp trong cùng 1 phút"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Lọc trùng</span>
              </button>
            )}

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition"
              title="Xuất danh sách chấm công lọc hiện tại ra tệp CSV"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>

        {/* Active Filters / Result Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80 text-slate-500 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Tìm thấy <strong className="text-slate-900 dark:text-white font-bold">{filteredLogs.length}</strong> / {logs.length} lượt chấm công
            </span>

            {selectedDepartment !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                Phòng ban: {selectedDepartment}
                <button onClick={() => setSelectedDepartment('all')} className="hover:text-emerald-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedPosition !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
                Bộ phận: {selectedPosition}
                <button onClick={() => setSelectedPosition('all')} className="hover:text-blue-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchPid.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-medium">
                Từ khóa: "{searchPid}"
                <button onClick={() => setSearchPid('')} className="hover:text-purple-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            Giờ vào chuẩn: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{settings.workStartTime || '08:30'}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3.5 pl-6">Thời gian</th>
                <th className="py-3.5 px-4">Nhân viên</th>
                <th className="py-3.5 px-4">Phòng ban & Bộ phận</th>
                <th className="py-3.5 px-4">Thiết bị ghi nhận</th>
                <th className="py-3.5 px-4">Thân nhiệt</th>
                <th className="py-3.5 px-4">Độ tin cậy</th>
                <th className="py-3.5 pr-6 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-medium">Không có lượt chấm công nào phù hợp với bộ lọc</p>
                    <p className="text-xs mt-1">Vui lòng thay đổi khoảng thời gian, phòng ban hoặc bấm "Đồng bộ từ thiết bị".</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const emp = empMap.get(log.pid);
                  const machine = machines.find(m => m.MachineBoxId === log.m);
                  const timeOnly = log.time.slice(11, 16);
                  const isLate = timeOnly > (settings.workStartTime || '08:30') && timeOnly < '12:00';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 pl-6 font-mono font-medium text-xs text-slate-900 dark:text-slate-100">
                        {log.time}
                      </td>

                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {emp?.photo ? (
                            <img
                              src={emp.photo}
                              alt={log.name}
                              className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-semibold text-xs">
                              {log.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-xs text-slate-900 dark:text-white leading-tight">
                              {log.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Mã: {emp?.code || log.pid} {emp?.code && emp.code !== log.pid ? `(ID: ${log.pid})` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Department & Division */}
                      <td className="py-3.5 px-4 text-xs">
                        {emp?.department ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                            <Building2 className="w-3 h-3 text-emerald-500" />
                            {emp.department}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phân ban</span>
                        )}
                        {emp?.position && (
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
                            <Briefcase className="w-3 h-3 text-slate-400" />
                            {emp.position}
                          </span>
                        )}
                      </td>

                      {/* Device */}
                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {machine?.MachineName || log.m}
                        </span>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          ID: {log.m}
                        </span>
                      </td>

                      {/* Temperature */}
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        {log.temp ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                              log.temp > 37.3
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            <Flame className="w-3 h-3" />
                            {log.temp}°C
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Similarity */}
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {log.similarity ? `${log.similarity}%` : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 pr-6 text-right">
                        {isLate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            <AlertTriangle className="w-3 h-3" />
                            Đi muộn ({timeOnly})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            <CheckCircle2 className="w-3 h-3" />
                            Hợp lệ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
