import React, { useState } from 'react';
import {
  Users,
  HardDrive,
  Calendar,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  Camera,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Activity,
  Wifi,
  Sparkles,
  DownloadCloud
} from 'lucide-react';
import { DahahiMachine, Employee, AttendanceLog, ConnectionSettings } from '../types/dahahi';
import { useAuth } from '../context/AuthContext';
import { DahahiDataService } from '../services/dahahiService';
import { ActiveTab } from './Header';

interface DashboardViewProps {
  machines: DahahiMachine[];
  employees: Employee[];
  logs: AttendanceLog[];
  settings: ConnectionSettings;
  setActiveTab: (tab: ActiveTab) => void;
  onRefreshData: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  machines,
  employees,
  logs,
  settings,
  setActiveTab,
  onRefreshData,
  showToast
}) => {
  const { hasPermission } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  // Today's date prefix "YYYY-MM-DD"
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(l => l.time.startsWith(todayStr));

  const registeredFaceCount = employees.filter(e => e.hasPhoto || !!e.photo).length;
  const noFaceCount = employees.length - registeredFaceCount;

  // Unique employees checked in today
  const checkedInTodaySet = new Set(todayLogs.map(l => l.pid));
  const checkedInCount = checkedInTodaySet.size;

  // Late calculation for today
  const startMins = Number((settings.workStartTime || '08:30').slice(0, 2)) * 60 + Number((settings.workStartTime || '08:30').slice(3, 5));
  let lateToday = 0;
  const firstCheckins: Record<string, string> = {};
  for (const log of todayLogs) {
    const timeOnly = log.time.slice(11, 16);
    if (!firstCheckins[log.pid] || timeOnly < firstCheckins[log.pid]) {
      firstCheckins[log.pid] = timeOnly;
    }
  }
  Object.values(firstCheckins).forEach(t => {
    const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    if (m > startMins) lateToday++;
  });

  const onTimeToday = Math.max(0, checkedInCount - lateToday);

  // Real sync logs from connected machines
  const handleQuickSyncLogs = async () => {
    if (machines.length === 0) {
      showToast('Chưa có máy chấm công nào được kết nối. Vui lòng kết nối máy trước.', 'error');
      setActiveTab('devices');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await DahahiDataService.syncLogsFromMachine(todayStr, todayStr);
      if (res && res.ok) {
        onRefreshData();
        showToast(res.message || `Đã đồng bộ ${res.added} lượt chấm công từ máy`, 'success');
      } else {
        showToast(res?.error || 'Lỗi khi đồng bộ từ máy', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi đồng bộ: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl shadow-emerald-950/20">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium mb-3">
            <Wifi className="w-3.5 h-3.5 text-emerald-300" />
            Hệ thống Quản lý Chấm công Khuôn mặt Dahahi AI
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quản trị & Giám sát Chấm công Trực tuyến
          </h2>
          <p className="mt-2 text-sm sm:text-base text-emerald-100/80 leading-relaxed">
            Kết nối máy chấm công dựa trên Domain, API Secret Key và Serial máy. Hỗ trợ tải xuống/tải lên danh sách nhân viên, nạp ảnh Face ID và xuất bảng công tháng.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {machines.length === 0 ? (
              <button
                onClick={() => setActiveTab('devices')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition"
              >
                <HardDrive className="w-4 h-4" />
                Kết nối máy chấm công ngay
              </button>
            ) : (
              <>
                <button
                  onClick={handleQuickSyncLogs}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm shadow-md transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ lịch sử từ máy'}
                </button>

                <button
                  onClick={() => setActiveTab('employees')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs sm:text-sm backdrop-blur-sm transition"
                >
                  <Users className="w-4 h-4" />
                  Danh sách & Face ID
                </button>

                <button
                  onClick={() => setActiveTab('report')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-700 text-slate-200 font-medium text-xs sm:text-sm transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Bảng công tháng
                </button>
              </>
            )}
          </div>
        </div>

        {/* Decorative backdrop shapes */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 -mb-16 w-80 h-80 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
      </div>

      {/* Notice if no machine connected */}
      {machines.length === 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                Chưa có máy chấm công nào được kết nối
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Vui lòng nhập Website Dahahi, Api Secret Key và Serial máy để bắt đầu đồng bộ dữ liệu thực tế.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('devices')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap transition"
          >
            Vào mục Kết nối máy &rarr;
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Machines */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Máy chấm công
            </span>
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {machines.length}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-0.5 inline" />
              {machines.length > 0 ? `${machines.length} Online` : 'Chưa có máy'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            {machines.map(m => m.MachineBoxId).join(', ') || 'Chưa kết nối máy nào'}
          </p>
          <button
            onClick={() => setActiveTab('devices')}
            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Quản lý thiết bị <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Employees */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng nhân viên
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {employees.length}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              hồ sơ
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              {registeredFaceCount} có Face ID
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <UserX className="w-3.5 h-3.5" />
              {noFaceCount} chưa ảnh
            </span>
          </div>
          <button
            onClick={() => setActiveTab('employees')}
            className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Danh sách nhân viên <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Today Attendance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Có mặt hôm nay
            </span>
            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {checkedInCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              / {employees.length} nhân sự
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Tổng cộng: <strong className="text-slate-800 dark:text-slate-200">{todayLogs.length}</strong> lượt quẹt mặt
          </p>
          <button
            onClick={() => setActiveTab('logs')}
            className="mt-3 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            Xem lịch sử hôm nay <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Punctuality */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Đúng giờ / Đi muộn
            </span>
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {onTimeToday}
            </span>
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              ({lateToday} muộn)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Mốc quy định: <strong className="text-slate-700 dark:text-slate-300">{settings.workStartTime || '08:30'}</strong>
          </p>
          <button
            onClick={() => setActiveTab('report')}
            className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            Bảng công chi tiết <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Row: Recent Logs + Devices overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Attendance Logs (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Lượt chấm công mới nhất
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghi nhận theo thời gian thực từ thiết bị Dahahi
              </p>
            </div>
            <button
              onClick={() => setActiveTab('logs')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Xem tất cả &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="pb-3 pl-1">Nhân viên</th>
                  <th className="pb-3">Thời gian</th>
                  <th className="pb-3">Thiết bị</th>
                  <th className="pb-3">Thân nhiệt</th>
                  <th className="pb-3 text-right pr-1">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Calendar className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="font-medium">Chưa có lượt chấm công nào được ghi nhận</p>
                      <p className="text-xs mt-1">Bấm "Đồng bộ lịch sử từ máy" hoặc quẹt thẻ trên máy để nhận dữ liệu.</p>
                    </td>
                  </tr>
                ) : (
                  logs.slice(0, 6).map(log => {
                    const emp = employees.find(e => e.id === log.pid);
                    const machine = machines.find(m => m.MachineBoxId === log.m);
                    const timeOnly = log.time.slice(11, 16);
                    const isLate = timeOnly > (settings.workStartTime || '08:30') && timeOnly < '12:00';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 pl-1">
                          <div className="flex items-center gap-3">
                            {emp?.photo ? (
                              <img
                                src={emp.photo}
                                alt={log.name}
                                className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-semibold text-xs">
                                {log.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                                {log.name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Mã: {log.pid} {emp?.department ? `• ${emp.department}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {log.time}
                        </td>
                        <td className="py-3 text-xs text-slate-600 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                            {machine?.MachineName || log.m}
                          </span>
                        </td>
                        <td className="py-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {log.temp ? `${log.temp}°C` : '—'}
                        </td>
                        <td className="py-3 text-right pr-1">
                          {isLate ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                              Đi muộn
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
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

        {/* Hardware Status & Quick Info (1 col) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-500" />
                Thiết bị kết nối
              </h3>
              <button
                onClick={() => setActiveTab('devices')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Cài đặt &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {machines.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  Chưa có máy nào được kết nối
                </div>
              ) : (
                machines.map(m => (
                  <div
                    key={m.MachineBoxId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="font-semibold text-xs text-slate-900 dark:text-white">
                          {m.MachineName}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Serial: <code className="font-mono">{m.MachineBoxId}</code>
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      Online
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Website Dahahi:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                  {settings.host || 'Chưa cấu hình'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tự động đồng bộ:</span>
                {settings.autoSync?.enabled ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Bật ({settings.autoSync.intervalMinutes}p/lần)
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">Đang tắt</span>
                )}
              </div>
              <div className="flex justify-between">
                <span>Webhook Checkin:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Đang hoạt động
                </span>
              </div>
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-5 border border-emerald-200/80 dark:border-slate-800">
            <h4 className="font-bold text-xs uppercase text-emerald-800 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              Nạp & Tải ảnh Face ID chuẩn máy Dahahi
            </h4>
            <ul className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span>Tự động nén ảnh về &le; 480px JPEG để bảo đảm tương thích phần cứng máy Dahahi.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span>Tải ảnh Face ID trực tiếp từ máy chấm công về hoặc đẩy từ máy tính lên.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span>Hỗ trợ chụp ảnh trực tiếp bằng Webcam với khung định vị khuôn mặt.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
