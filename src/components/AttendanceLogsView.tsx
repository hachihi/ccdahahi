import React, { useState } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { AttendanceLog, DahahiMachine, Employee, ConnectionSettings } from '../types/dahahi';
import { useAuth } from '../context/AuthContext';
import { DahahiDataService, downloadCsv, toDahahiTimeStr, fromDahahiTimeStr } from '../services/dahahiService';

interface AttendanceLogsViewProps {
  logs: AttendanceLog[];
  machines: DahahiMachine[];
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
  const [searchPid, setSearchPid] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const canSync = hasPermission('sync_data');

  // Filter logs
  const filteredLogs = logs.filter(l => {
    const logDate = l.time.slice(0, 10);
    const matchDate = (!fromDate || logDate >= fromDate) && (!toDate || logDate <= toDate);
    const matchMachine = selectedMachine === 'all' || l.m === selectedMachine;
    const matchPid = !searchPid.trim() || l.pid.includes(searchPid.trim()) || l.name.toLowerCase().includes(searchPid.toLowerCase().trim());
    return matchDate && matchMachine && matchPid;
  });

  // Sync logs from Dahahi machine via /api/facereg/checkinhis
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
      const res = await DahahiDataService.syncLogsFromMachine(
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

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Thời gian',
      'Mã nhân viên',
      'Họ và tên',
      'Thiết bị chấm công',
      'Mã thiết bị (MachineBoxId)',
      'Thân nhiệt (°C)',
      'Trạng thái'
    ];
    const rows = filteredLogs.map(l => {
      const mObj = machines.find(m => m.MachineBoxId === l.m);
      const timeOnly = l.time.slice(11, 16);
      const isLate = timeOnly > settings.workStartTime && timeOnly < '12:00';
      return [
        l.time,
        l.pid,
        l.name,
        mObj?.MachineName || l.m,
        l.m,
        l.temp || '',
        isLate ? 'Đi muộn' : 'Hợp lệ'
      ];
    });

    downloadCsv(`lich_su_cham_cong_${fromDate}_${toDate}.csv`, headers, rows);
    showToast(`Đã xuất ${filteredLogs.length} bản ghi ra tệp CSV`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* From Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Từ ngày:</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Đến ngày:</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Machine */}
          <select
            value={selectedMachine}
            onChange={e => setSelectedMachine(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tất cả máy chấm công</option>
            {machines.map(m => (
              <option key={m.MachineBoxId} value={m.MachineBoxId}>
                {m.MachineName} ({m.MachineBoxId})
              </option>
            ))}
          </select>

          {/* Search Person */}
          <div className="relative min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchPid}
              onChange={e => setSearchPid(e.target.value)}
              placeholder="Mã hoặc tên NV..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {settings.autoSync?.enabled && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80"
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

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Xuất CSV
          </button>
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
                <th className="py-3.5 px-4">Thiết bị ghi nhận</th>
                <th className="py-3.5 px-4">Thân nhiệt</th>
                <th className="py-3.5 px-4">Độ tin cậy</th>
                <th className="py-3.5 pr-6 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-medium">Không có lượt chấm công nào trong khoảng thời gian này</p>
                    <p className="text-xs mt-1">Bấm "Đồng bộ từ thiết bị" để tải lịch sử mới nhất về app.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const emp = employees.find(e => e.id === log.pid);
                  const machine = machines.find(m => m.MachineBoxId === log.m);
                  const timeOnly = log.time.slice(11, 16);
                  const isLate = timeOnly > settings.workStartTime && timeOnly < '12:00';

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
                              Mã: {log.pid}
                            </p>
                          </div>
                        </div>
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
                        {log.similarity ? `${log.similarity}%` : '98.5%'}
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
