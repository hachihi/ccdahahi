import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Users,
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Activity,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { HachihiMachine, Employee, AttendanceLog, ConnectionSettings } from '../types/hachihi';
import { HachihiDataService } from '../services/hachihiService';

interface KPIDashboardProps {
  machines?: HachihiMachine[];
  employees?: Employee[];
  logs?: AttendanceLog[];
  settings?: ConnectionSettings;
  onRefresh?: () => void;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  machines: propMachines,
  employees: propEmployees,
  logs: propLogs,
  settings: propSettings,
  onRefresh
}) => {
  const [internalMachines, setInternalMachines] = useState<HachihiMachine[]>(propMachines || []);
  const [internalEmployees, setInternalEmployees] = useState<Employee[]>(propEmployees || []);
  const [internalLogs, setInternalLogs] = useState<AttendanceLog[]>(propLogs || []);
  const [internalSettings, setInternalSettings] = useState<ConnectionSettings>(propSettings || {
    host: '',
    appKey: '',
    secretKey: '',
    serial: '',
    workStartTime: '08:30',
    workEndTime: '17:30',
    callbackCheckinUrl: '',
    callbackHeartbeatUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | 'week'>('today');

  // Sync internal state when props change
  useEffect(() => {
    if (propMachines) setInternalMachines(propMachines);
  }, [propMachines]);

  useEffect(() => {
    if (propEmployees) setInternalEmployees(propEmployees);
  }, [propEmployees]);

  useEffect(() => {
    if (propLogs) setInternalLogs(propLogs);
  }, [propLogs]);

  useEffect(() => {
    if (propSettings) setInternalSettings(propSettings);
  }, [propSettings]);

  // Self-fetch if rendered standalone or requested
  const fetchLatestStats = async () => {
    setLoading(true);
    try {
      const [m, e, l, s] = await Promise.all([
        HachihiDataService.getMachines(),
        HachihiDataService.getEmployees(),
        HachihiDataService.getLogs(),
        HachihiDataService.getSettings()
      ]);
      setInternalMachines(m);
      setInternalEmployees(e);
      setInternalLogs(l);
      setInternalSettings(s);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('KPIDashboard auto-fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh interval every 45s for real-time monitoring
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatestStats();
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  const machines = internalMachines;
  const employees = internalEmployees;
  const logs = internalLogs;
  const settings = internalSettings;

  // 1. Calculations: Today's date & Attendance Stats
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayLogs = useMemo(() => logs.filter(l => l.time.startsWith(todayStr)), [logs, todayStr]);

  // Unique employees who checked in today
  const checkedInEmpIds = useMemo(() => new Set(todayLogs.map(l => l.pid)), [todayLogs]);
  const checkedInCount = checkedInEmpIds.size;
  const totalEmployees = employees.length;

  // Attendance Rate Today (%)
  const attendanceRate = totalEmployees > 0 ? Math.round((checkedInCount / totalEmployees) * 100) : 0;

  // Standard work start in minutes
  const workStartMins = useMemo(() => {
    const [h, m] = (settings.workStartTime || '08:30').split(':').map(Number);
    return (h || 8) * 60 + (m || 30);
  }, [settings.workStartTime]);

  // First check-in time per employee today to calculate late arrivals
  const { lateTodayCount, onTimeCount } = useMemo(() => {
    const firstPunches: Record<string, string> = {};
    for (const log of todayLogs) {
      const hm = log.time.slice(11, 16);
      if (!firstPunches[log.pid] || hm < firstPunches[log.pid]) {
        firstPunches[log.pid] = hm;
      }
    }

    let late = 0;
    Object.values(firstPunches).forEach(hm => {
      const [h, m] = hm.split(':').map(Number);
      const mins = h * 60 + m;
      if (mins > workStartMins) {
        late++;
      }
    });

    const onTime = Math.max(0, checkedInCount - late);
    return { lateTodayCount: late, onTimeCount: onTime };
  }, [todayLogs, checkedInCount, workStartMins]);

  const absentCount = Math.max(0, totalEmployees - checkedInCount);
  const lateRate = checkedInCount > 0 ? Math.round((lateTodayCount / checkedInCount) * 100) : 0;

  // 2. Devices Online Status
  const onlineDevicesCount = useMemo(() => {
    return machines.filter(m => m.isOnline !== false).length;
  }, [machines]);
  const totalDevices = machines.length;
  const deviceOnlineRate = totalDevices > 0 ? Math.round((onlineDevicesCount / totalDevices) * 100) : 0;

  // 3. Hourly Flow Distribution Data for Recharts AreaChart
  const hourlyData = useMemo(() => {
    const hours = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const counts: Record<string, { onTime: number; late: number; total: number }> = {};
    hours.forEach(h => {
      counts[h] = { onTime: 0, late: 0, total: 0 };
    });

    todayLogs.forEach(log => {
      const hourStr = log.time.slice(11, 13) + ':00';
      if (counts[hourStr]) {
        counts[hourStr].total += 1;
        const [h, m] = log.time.slice(11, 16).split(':').map(Number);
        if (h * 60 + m <= workStartMins) {
          counts[hourStr].onTime += 1;
        } else {
          counts[hourStr].late += 1;
        }
      }
    });

    return hours.map(h => ({
      hour: h,
      'Đúng giờ': counts[h].onTime,
      'Đi muộn': counts[h].late,
      'Tổng lượt': counts[h].total
    }));
  }, [todayLogs, workStartMins]);

  // 4. Department Attendance Breakdown for Recharts BarChart
  const departmentData = useMemo(() => {
    const deptMap: Record<string, { total: number; present: number }> = {};

    employees.forEach(e => {
      const dept = e.department?.trim() || 'Văn phòng';
      if (!deptMap[dept]) {
        deptMap[dept] = { total: 0, present: 0 };
      }
      deptMap[dept].total += 1;
      if (checkedInEmpIds.has(e.id)) {
        deptMap[dept].present += 1;
      }
    });

    return Object.entries(deptMap).map(([dept, data]) => ({
      department: dept.length > 12 ? dept.slice(0, 10) + '..' : dept,
      fullName: dept,
      'Có mặt': data.present,
      'Vắng': Math.max(0, data.total - data.present),
      'Tỷ lệ (%)': data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
    }));
  }, [employees, checkedInEmpIds]);

  // 5. Workforce Status Pie / Donut Data
  const donutData = useMemo(() => [
    { name: 'Đúng giờ', value: onTimeCount, color: '#10B981' }, // Emerald
    { name: 'Đi muộn', value: lateTodayCount, color: '#F59E0B' }, // Amber
    { name: 'Chưa có mặt', value: absentCount, color: '#64748B' } // Slate
  ], [onTimeCount, lateTodayCount, absentCount]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Live Status & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-900/90 via-teal-900/80 to-slate-900 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Real-time Analytics • Hachihi Face AI
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
            Bảng Chỉ Số Hiệu Suất Chấm Công (KPI Dashboard)
          </h2>
          <p className="text-xs text-emerald-100/70 mt-0.5">
            Dữ liệu trực tiếp từ các máy nhận diện khuôn mặt kết nối theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex bg-white/10 backdrop-blur rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'today' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'week' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              7 ngày qua
            </button>
          </div>

          <button
            onClick={fetchLatestStats}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
            title="Làm mới chỉ số KPI"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Three Primary KPI Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1: Attendance Rate Today */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attendance Rate Today
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400">
              {attendanceRate}%
            </span>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {checkedInCount}
              </span>
              /{totalEmployees} nhân sự
            </div>
          </div>

          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, attendanceRate)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tỷ lệ có mặt tại văn phòng</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {checkedInCount} Đã check-in
            </span>
          </div>
        </div>

        {/* KPI 2: Late Arrivals Count */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Late Arrivals Count
            </span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-black text-amber-600 dark:text-amber-400">
              {lateTodayCount}
            </span>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-amber-700 dark:text-amber-300 text-sm">
                {lateRate}%
              </span>{' '}
              tổng người đến
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-2.5"
                style={{ width: `${checkedInCount > 0 ? (onTimeCount / checkedInCount) * 100 : 0}%` }}
                title={`Đúng giờ: ${onTimeCount}`}
              />
              <div
                className="bg-amber-500 h-2.5"
                style={{ width: `${checkedInCount > 0 ? (lateTodayCount / checkedInCount) * 100 : 0}%` }}
                title={`Đi muộn: ${lateTodayCount}`}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Mốc giờ chuẩn: <strong className="text-slate-700 dark:text-slate-300">{settings.workStartTime || '08:30'}</strong></span>
            <span className={`font-semibold ${lateTodayCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {lateTodayCount === 0 ? 'Không có ai muộn' : `${lateTodayCount} người vi phạm`}
            </span>
          </div>
        </div>

        {/* KPI 3: Devices Online Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Devices Online Status
            </span>
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-black text-blue-600 dark:text-blue-400">
              {onlineDevicesCount}
              <span className="text-2xl text-slate-400 font-normal">/{totalDevices}</span>
            </span>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {deviceOnlineRate}%
              </span>{' '}
              sẵn sàng
            </div>
          </div>

          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                onlineDevicesCount === totalDevices && totalDevices > 0
                  ? 'bg-emerald-500'
                  : onlineDevicesCount > 0
                  ? 'bg-blue-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(10, deviceOnlineRate)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate max-w-[150px]">
              {machines[0]?.MachineName || (settings.serial ? `Máy Box ${settings.serial}` : 'Chưa kết nối')}
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              {onlineDevicesCount > 0 ? 'Đang hoạt động' : 'Ngoại tuyến'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Recharts Visual Section: Donut + Hourly Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart A: Workforce Presence Donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Cơ cấu Hiện diện Hôm nay
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tỷ lệ phân bổ đúng giờ, đi muộn và vắng mặt
            </p>
          </div>

          <div className="relative h-64 flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} nhân sự`, name]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner text in Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {attendanceRate}%
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Có mặt
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {onTimeCount}
              </div>
              <div className="text-[10px] text-slate-500">Đúng giờ</div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40">
              <div className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                {lateTodayCount}
              </div>
              <div className="text-[10px] text-slate-500">Đi muộn</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                {absentCount}
              </div>
              <div className="text-[10px] text-slate-500">Chưa đến</div>
            </div>
          </div>
        </div>

        {/* Chart B: Hourly Check-in Flow (AreaChart) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                Lưu lượng Chấm công theo Giờ trong Ngày
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nhịp độ quét khuôn mặt ghi nhận qua cảm biến camera Hachihi
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {todayLogs.length} Lượt hôm nay
            </span>
          </div>

          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="hour" tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis allowDecimals={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="Đúng giờ"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOnTime)"
                />
                <Area
                  type="monotone"
                  dataKey="Đi muộn"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLate)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Cao điểm buổi sáng thường từ 07:45 - 08:30</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Tổng nhân sự: {employees.length}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Department Attendance BarChart + Connected Hardware List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Breakdown BarChart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                Hiện diện theo Phòng Ban
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                So sánh số lượng nhân sự có mặt thực tế so với tổng biên chế
              </p>
            </div>
          </div>

          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="department" tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis allowDecimals={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} nhân sự`, name]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Có mặt" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Vắng" fill="#E2E8F0" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>Cập nhật tự động sau mỗi lần quẹt mặt thành công</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {departmentData.length} phòng ban
            </span>
          </div>
        </div>

        {/* Real-time Hardware Status Monitor */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-500" />
              Tình trạng Thiết bị Hachihi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Giám sát kết nối mạng & xung nhịp heartbeat
            </p>
          </div>

          <div className="space-y-3 my-4 overflow-y-auto max-h-56 pr-1">
            {machines.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                Chưa có máy nào được kết nối. Vui lòng vào mục "Kết nối thiết bị" để thêm máy chấm công.
              </div>
            ) : (
              machines.map(m => {
                const isOnline = m.isOnline !== false;
                const machineLogsCount = todayLogs.filter(l => l.m === m.MachineBoxId).length;

                return (
                  <div
                    key={m.MachineBoxId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {m.MachineName || `Máy ${m.MachineBoxId}`}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          ID: {m.MachineBoxId} {m.ip ? `• IP: ${m.ip}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOnline
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {isOnline ? 'Trực tuyến' : 'Mất kết nối'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {machineLogsCount} lượt quẹt
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Chu kỳ đồng bộ:</span>
            <span className="font-bold text-teal-600 dark:text-teal-400">
              {settings.autoSync?.enabled ? `${settings.autoSync.intervalMinutes} phút / lần` : 'Đang tắt'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default KPIDashboard;
