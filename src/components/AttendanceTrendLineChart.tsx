import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon,
  Download,
  Eye,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { AttendanceLog, Employee } from '../types/hachihi';
import { downloadCsv } from '../services/hachihiService';

interface AttendanceTrendLineChartProps {
  logs: AttendanceLog[];
  employees: Employee[];
  workStartTime?: string;
  onRefresh?: () => void;
  className?: string;
}

export const AttendanceTrendLineChart: React.FC<AttendanceTrendLineChartProps> = ({
  logs,
  employees,
  workStartTime = '08:30',
  onRefresh,
  className = ''
}) => {
  // View mode: 'count' (people) or 'percent' (%)
  const [viewMode, setViewMode] = useState<'count' | 'percent'>('count');
  // Visibility toggles for individual lines
  const [showPresent, setShowPresent] = useState(true);
  const [showOnTime, setShowOnTime] = useState(true);
  const [showLate, setShowLate] = useState(true);
  const [showAbsent, setShowAbsent] = useState(false);
  // Expandable table view
  const [showTable, setShowTable] = useState(false);

  // Helper date formatters
  const formatDateYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDayNameVN = (dayIndex: number): string => {
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[dayIndex] || '';
  };

  // Standard work start time in minutes from midnight
  const startMins = useMemo(() => {
    const [h, m] = (workStartTime || '08:30').split(':').map(Number);
    return (h || 8) * 60 + (m || 30);
  }, [workStartTime]);

  // Compute 7-day trend data ending on today or the latest available log date
  const trendData = useMemo(() => {
    let anchor = new Date();
    if (logs.length > 0) {
      const validDates = logs.map(l => l.time.slice(0, 10)).filter(Boolean).sort();
      if (validDates.length > 0) {
        const maxDateStr = validDates[validDates.length - 1];
        const maxLogDate = new Date(maxDateStr + 'T00:00:00');
        if (maxLogDate > anchor) {
          anchor = maxLogDate;
        }
      }
    }

    const totalEmp = employees.length || 1;
    const items = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      const ymd = formatDateYMD(d);
      const dayOfWeek = getDayNameVN(d.getDay());
      const displayShort = `${d.getDate()}/${d.getMonth() + 1}`;
      const dayLabel = `${dayOfWeek} (${displayShort})`;

      // Logs on this day
      const dayLogs = logs.filter(l => l.time.startsWith(ymd));
      const totalPunches = dayLogs.length;

      // Group first punches per employee to determine attendance & punctuality
      const firstPunches: Record<string, string> = {};
      dayLogs.forEach(l => {
        const timeOnly = l.time.slice(11, 16);
        if (!firstPunches[l.pid] || timeOnly < firstPunches[l.pid]) {
          firstPunches[l.pid] = timeOnly;
        }
      });

      const presentCount = Object.keys(firstPunches).length;

      let lateCount = 0;
      Object.values(firstPunches).forEach(timeStr => {
        const [h, m] = timeStr.split(':').map(Number);
        if ((h || 0) * 60 + (m || 0) > startMins) {
          lateCount++;
        }
      });

      const onTimeCount = Math.max(0, presentCount - lateCount);
      const absentCount = Math.max(0, employees.length - presentCount);
      const attendanceRate = employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0;
      const onTimeRate = presentCount > 0 ? Math.round((onTimeCount / presentCount) * 100) : 0;
      const lateRate = presentCount > 0 ? Math.round((lateCount / presentCount) * 100) : 0;
      const absentRate = 100 - attendanceRate;

      items.push({
        date: ymd,
        dayOfWeek,
        displayDate: displayShort,
        name: dayLabel,
        // Count metrics
        'Có mặt': presentCount,
        'Đúng giờ': onTimeCount,
        'Đi muộn': lateCount,
        'Vắng mặt': absentCount,
        // Percentage metrics
        'Tỷ lệ có mặt (%)': attendanceRate,
        'Tỷ lệ đúng giờ (%)': onTimeRate,
        'Tỷ lệ đi muộn (%)': lateRate,
        'Tỷ lệ vắng mặt (%)': absentRate,
        totalPunches,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }

    return items;
  }, [logs, employees, startMins]);

  // Aggregate statistics for the 7 days
  const stats = useMemo(() => {
    if (trendData.length === 0) {
      return {
        avgPresent: 0,
        avgRate: 0,
        avgOnTimeRate: 0,
        peakDay: '—',
        peakCount: 0,
        trendGrowth: 0,
        totalPunchesWeek: 0,
        totalLateWeek: 0
      };
    }

    // Exclude weekends if they have 0 punches, otherwise calculate all
    const weekdays = trendData.filter(d => !d.isWeekend || d['Có mặt'] > 0);
    const validSet = weekdays.length > 0 ? weekdays : trendData;

    const totalPresent = validSet.reduce((sum, d) => sum + d['Có mặt'], 0);
    const avgPresent = Math.round((totalPresent / validSet.length) * 10) / 10;
    const avgRate = employees.length > 0 ? Math.round((avgPresent / employees.length) * 100) : 0;

    const totalLate = validSet.reduce((sum, d) => sum + d['Đi muộn'], 0);
    const totalOnTime = validSet.reduce((sum, d) => sum + d['Đúng giờ'], 0);
    const avgOnTimeRate = totalPresent > 0 ? Math.round((totalOnTime / totalPresent) * 100) : 0;

    // Peak day
    let peakDay = trendData[0];
    trendData.forEach(d => {
      if (d['Có mặt'] > peakDay['Có mặt']) {
        peakDay = d;
      }
    });

    // Trend growth: compare last day vs first day with attendance
    const firstActive = trendData.find(d => d['Có mặt'] > 0) || trendData[0];
    const lastActive = [...trendData].reverse().find(d => d['Có mặt'] > 0) || trendData[trendData.length - 1];
    let trendGrowth = 0;
    if (firstActive && lastActive && firstActive['Có mặt'] > 0) {
      trendGrowth = Math.round(((lastActive['Có mặt'] - firstActive['Có mặt']) / firstActive['Có mặt']) * 100);
    }

    const totalPunchesWeek = trendData.reduce((sum, d) => sum + d.totalPunches, 0);

    return {
      avgPresent,
      avgRate,
      avgOnTimeRate,
      peakDay: `${peakDay.dayOfWeek} (${peakDay.displayDate})`,
      peakCount: peakDay['Có mặt'],
      trendGrowth,
      totalPunchesWeek,
      totalLateWeek: totalLate
    };
  }, [trendData, employees.length]);

  // Export 7-day trend to CSV
  const handleExportCsv = () => {
    const headers = [
      'Ngày',
      'Thứ',
      'Tổng nhân sự',
      'Có mặt',
      'Tỷ lệ có mặt (%)',
      'Đúng giờ',
      'Đi muộn',
      'Vắng mặt',
      'Tổng lượt quẹt thẻ/mặt'
    ];
    const rows = trendData.map(d => [
      d.date,
      d.dayOfWeek,
      employees.length,
      d['Có mặt'],
      `${d['Tỷ lệ có mặt (%)']}%`,
      d['Đúng giờ'],
      d['Đi muộn'],
      d['Vắng mặt'],
      d.totalPunches
    ]);
    downloadCsv(`xu_huong_cham_cong_7_ngay_${trendData[trendData.length - 1]?.date || 'hachihi'}.csv`, headers, rows);
  };

  // Dynamic keys depending on viewMode
  const presentKey = viewMode === 'count' ? 'Có mặt' : 'Tỷ lệ có mặt (%)';
  const onTimeKey = viewMode === 'count' ? 'Đúng giờ' : 'Tỷ lệ đúng giờ (%)';
  const lateKey = viewMode === 'count' ? 'Đi muộn' : 'Tỷ lệ đi muộn (%)';
  const absentKey = viewMode === 'count' ? 'Vắng mặt' : 'Tỷ lệ vắng mặt (%)';

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-xs text-white min-w-[220px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60 font-semibold text-slate-200">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Calendar className="w-3.5 h-3.5" />
              {label}
            </span>
            <span className="text-[11px] font-mono text-slate-400">{row.date}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Có mặt:
              </span>
              <span className="font-bold text-emerald-400">
                {row['Có mặt']} người{' '}
                <span className="text-[10px] text-slate-400">({row['Tỷ lệ có mặt (%)']}%)</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                Đúng giờ:
              </span>
              <span className="font-semibold text-teal-300">
                {row['Đúng giờ']} người{' '}
                <span className="text-[10px] text-slate-400">({row['Tỷ lệ đúng giờ (%)']}%)</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Đi muộn:
              </span>
              <span className="font-semibold text-amber-400">
                {row['Đi muộn']} người{' '}
                <span className="text-[10px] text-slate-400">({row['Tỷ lệ đi muộn (%)']}%)</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Vắng mặt:
              </span>
              <span className="font-semibold text-rose-400">{row['Vắng mặt']} người</span>
            </div>

            <div className="pt-2 mt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Tổng lượt quẹt camera:</span>
              <span className="font-mono font-bold text-white">{row.totalPunches} lượt</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden ${className}`}
    >
      {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-teal-500" />
            Phân tích Chuỗi Thời Gian • Recharts
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Xu hướng Chấm công 7 Ngày gần nhất
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Giám sát biến động quân số, tỷ lệ đi đúng giờ và số lượng nhân sự vi phạm đi muộn
          </p>
        </div>

        {/* View Switchers & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Mode Switcher: Count vs Percent */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              onClick={() => setViewMode('count')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'count'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Số người
            </button>
            <button
              onClick={() => setViewMode('percent')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'percent'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tỷ lệ %
            </button>
          </div>

          {/* Detailed Table Toggle */}
          <button
            onClick={() => setShowTable(!showTable)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              showTable
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
            title="Xem chi tiết từng ngày dưới dạng bảng"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showTable ? 'Ẩn bảng số liệu' : 'Bảng số liệu'}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            title="Tải báo cáo xu hướng 7 ngày dạng CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              title="Làm mới dữ liệu biểu đồ"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Four Mini Metric Badges for 7-Day Performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-5">
        {/* Metric 1: Average Attendance */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>TB Có mặt / ngày</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {stats.avgPresent}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              người <strong className="text-emerald-600 dark:text-emerald-400">({stats.avgRate}%)</strong>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tổng quân số: {employees.length} người</p>
        </div>

        {/* Metric 2: Average On-Time Rate */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Tỷ lệ Đúng giờ TB</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400">
              {stats.avgOnTimeRate}%
            </span>
            <span className="text-xs text-slate-500">trên số có mặt</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Chuẩn vào ca: {workStartTime}</p>
        </div>

        {/* Metric 3: Peak Day */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Ngày cao điểm</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
              {stats.peakDay}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Đạt <strong className="text-blue-600 dark:text-blue-400">{stats.peakCount}</strong> nhân sự quẹt mặt
          </p>
        </div>

        {/* Metric 4: Trend Growth & Total Late */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Biến động tuần</span>
            {stats.trendGrowth >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-extrabold ${
                stats.trendGrowth > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : stats.trendGrowth < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {stats.trendGrowth > 0 ? `+${stats.trendGrowth}%` : `${stats.trendGrowth}%`}
            </span>
            <span className="text-xs text-slate-500">so với đầu kỳ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Tổng lượt đi muộn 7 ngày: <strong className="text-amber-600">{stats.totalLateWeek}</strong>
          </p>
        </div>
      </div>

      {/* 3. Metric Line Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-medium">
        <span className="text-slate-400 dark:text-slate-500 mr-1 text-[11px] font-semibold uppercase tracking-wider">
          Đường biểu diễn:
        </span>

        {/* Present Line Toggle */}
        <button
          onClick={() => setShowPresent(!showPresent)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
            showPresent
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
              : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Có mặt (Hiện diện)
        </button>

        {/* On-Time Line Toggle */}
        <button
          onClick={() => setShowOnTime(!showOnTime)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
            showOnTime
              ? 'bg-teal-500/10 border-teal-500 text-teal-700 dark:text-teal-300 font-bold'
              : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
          Đúng giờ
        </button>

        {/* Late Line Toggle */}
        <button
          onClick={() => setShowLate(!showLate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
            showLate
              ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
              : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Đi muộn
        </button>

        {/* Absent Line Toggle */}
        <button
          onClick={() => setShowAbsent(!showAbsent)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
            showAbsent
              ? 'bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 font-bold'
              : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          Vắng mặt
        </button>
      </div>

      {/* 4. The Recharts Line Chart */}
      <div className="h-80 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B' }}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B' }}
              unit={viewMode === 'percent' ? '%' : ''}
              domain={viewMode === 'percent' ? [0, 100] : [0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '14px' }}
              iconType="circle"
            />

            {/* Reference Line for 80% attendance rate in percent mode */}
            {viewMode === 'percent' && (
              <ReferenceLine
                y={80}
                stroke="#10B981"
                strokeDasharray="4 4"
                label={{
                  value: 'Mục tiêu 80%',
                  fill: '#10B981',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />
            )}

            {/* Line 1: Present */}
            {showPresent && (
              <Line
                type="monotone"
                dataKey={presentKey}
                name="Có mặt"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: '#10B981' }}
                activeDot={{ r: 7, strokeWidth: 0, fill: '#10B981' }}
              />
            )}

            {/* Line 2: On-Time */}
            {showOnTime && (
              <Line
                type="monotone"
                dataKey={onTimeKey}
                name="Đúng giờ"
                stroke="#0D9488"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, fill: '#ffffff', stroke: '#0D9488' }}
                activeDot={{ r: 6, fill: '#0D9488' }}
              />
            )}

            {/* Line 3: Late */}
            {showLate && (
              <Line
                type="monotone"
                dataKey={lateKey}
                name="Đi muộn"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, fill: '#ffffff', stroke: '#F59E0B' }}
                activeDot={{ r: 6, fill: '#F59E0B' }}
              />
            )}

            {/* Line 4: Absent */}
            {showAbsent && (
              <Line
                type="monotone"
                dataKey={absentKey}
                name="Vắng mặt"
                stroke="#F43F5E"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, strokeWidth: 2, fill: '#ffffff', stroke: '#F43F5E' }}
                activeDot={{ r: 6, fill: '#F43F5E' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Detailed Data Table (Expandable) */}
      {showTable && (
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <TableIcon className="w-3.5 h-3.5 text-emerald-500" />
              Bảng dữ liệu chi tiết xu hướng 7 ngày
            </h4>
            <span className="text-[11px] text-slate-500">
              {trendData.length} mốc ngày ghi nhận
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Ngày</th>
                  <th className="py-2.5 px-3">Thứ</th>
                  <th className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Có mặt</th>
                  <th className="py-2.5 px-3 text-teal-600 dark:text-teal-400">Đúng giờ</th>
                  <th className="py-2.5 px-3 text-amber-600 dark:text-amber-400">Đi muộn</th>
                  <th className="py-2.5 px-3 text-rose-600 dark:text-rose-400">Vắng</th>
                  <th className="py-2.5 px-3 font-bold">Tỷ lệ hiện diện</th>
                  <th className="py-2.5 px-3 text-right">Lượt quét</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {trendData.map(d => (
                  <tr
                    key={d.date}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                      d.isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/30 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                      {d.date}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span className={d.isWeekend ? 'text-amber-500 font-medium' : ''}>
                        {d.dayOfWeek}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {d['Có mặt']}
                    </td>
                    <td className="py-2 px-3 text-teal-600 dark:text-teal-400">{d['Đúng giờ']}</td>
                    <td className="py-2 px-3 text-amber-600 dark:text-amber-400">{d['Đi muộn']}</td>
                    <td className="py-2 px-3 text-rose-500">{d['Vắng mặt']}</td>
                    <td className="py-2 px-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{d['Tỷ lệ có mặt (%)']}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${d['Tỷ lệ có mặt (%)']}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{d.totalPunches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Footer Note */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Dữ liệu tổng hợp từ các máy khuôn mặt Hachihi. Quản trị viên có thể bấm "Đồng bộ từ máy" để cập nhật ngay.
          </span>
        </div>
        <span className="font-medium text-slate-600 dark:text-slate-400">
          Tổng lượt quẹt tuần: <strong>{stats.totalPunchesWeek}</strong> lượt
        </span>
      </div>
    </div>
  );
};

export default AttendanceTrendLineChart;
