import { AttendanceLog, HachihiMachine, Employee } from '../types/hachihi';
import { WorkConfig } from './workConfig';
import { PayrollRow, computeMonth, dedupeLogs, summarizePayroll } from './workdayEngine';
import { formatDateVi } from './timeUtils';

export { formatDateVi };

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

export interface ReportFilter {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  machineId: string; // "all" hoặc MachineBoxId
  department: string; // "all" hoặc tên phòng ban
  keyword: string; // tìm theo mã / tên
  dedupeSeconds: number; // bỏ lần chấm trùng trong N giây (0 = tắt)
}

/** Mẫu 6: mỗi dòng = 1 nhân viên + 1 ngày + 1 máy */
export interface MachineDetailRow {
  code: string;
  name: string;
  date: string; // YYYY-MM-DD
  machineId: string;
  machineName: string;
  punches: string[]; // HH:mm:ss, đã sắp xếp tăng dần
}

/** Mẫu 2: mỗi dòng = 1 nhân viên + 1 ngày (gộp mọi máy) */
export interface DailyDetailRow {
  stt: number;
  code: string;
  name: string;
  department: string;
  date: string;
  firstIn: string; // HH:mm hoặc ''
  lastOut: string; // HH:mm hoặc '' (khi chỉ có 1 lần chấm)
  shiftCode: string;
  stdIn: string;
  stdOut: string;
  lateMinutes: number;
  earlyMinutes: number;
  workHours: number;
  note: string;
}

const matches = (department: string, code: string, name: string, f: ReportFilter): boolean => {
  if (f.department !== 'all' && department !== f.department) return false;
  const kw = f.keyword.trim().toLowerCase();
  return !kw || code.toLowerCase().includes(kw) || name.toLowerCase().includes(kw);
};

/* ------------------------------------------------------------------ */
/* Mẫu 6 - Nhật ký chấm công theo máy                                  */
/* ------------------------------------------------------------------ */

export const buildMachineDetailReport = (
  logs: AttendanceLog[],
  employees: Employee[],
  machines: HachihiMachine[],
  filter: ReportFilter
): { rows: MachineDetailRow[]; maxPunches: number } => {
  const empMap = new Map(employees.map(e => [e.id, e]));
  const machineName = new Map(machines.map(m => [m.MachineBoxId, m.MachineName]));
  const groups = new Map<string, MachineDetailRow>();

  const sorted = logs
    .filter(l => l.time && l.time.slice(0, 10) >= filter.from && l.time.slice(0, 10) <= filter.to)
    .filter(l => filter.machineId === 'all' || l.m === filter.machineId)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));

  for (const l of dedupeLogs(sorted, filter.dedupeSeconds)) {
    const emp = empMap.get(l.pid);
    const code = emp?.code || l.pid;
    const name = emp?.name || l.name || `(Mã NV: ${l.pid})`;
    if (!matches(emp?.department || 'Chung', code, name, filter)) continue;
    const date = l.time.slice(0, 10);
    const key = `${l.pid}|${date}|${l.m}`;
    let row = groups.get(key);
    if (!row) {
      row = { code, name, date, machineId: l.m, machineName: machineName.get(l.m) || l.m || '—', punches: [] };
      groups.set(key, row);
    }
    row.punches.push(l.time.slice(11, 19));
  }

  const rows = Array.from(groups.values()).sort(
    (a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }) ||
      a.date.localeCompare(b.date) ||
      a.machineName.localeCompare(b.machineName)
  );
  return { rows, maxPunches: rows.reduce((mx, r) => Math.max(mx, r.punches.length), 1) };
};

/* ------------------------------------------------------------------ */
/* Mẫu 2 - Chi tiết vào/ra (dùng engine tính công theo ca)             */
/* ------------------------------------------------------------------ */

export const buildDailyDetailReport = (
  logs: AttendanceLog[],
  employees: Employee[],
  filter: ReportFilter,
  config: WorkConfig
): DailyDetailRow[] => {
  const days = computeMonth({
    logs,
    employees,
    config,
    from: filter.from,
    to: filter.to,
    machineId: filter.machineId,
    dedupeSeconds: filter.dedupeSeconds
  });

  return days
    .filter(d => d.punchCount > 0 && matches(d.department, d.code, d.name, filter))
    .sort(
      (a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }) || a.date.localeCompare(b.date)
    )
    .map((d, i) => ({
      stt: i + 1,
      code: d.code,
      name: d.name,
      department: d.department,
      date: d.date,
      firstIn: d.firstIn,
      lastOut: d.lastOut,
      shiftCode: d.shift.code,
      stdIn: d.shift.start,
      stdOut: d.shift.end,
      lateMinutes: d.lateMin,
      earlyMinutes: d.earlyMin,
      workHours: Math.round((d.workMinutes / 60) * 100) / 100,
      note: d.note
    }));
};

/* ------------------------------------------------------------------ */
/* Mẫu 5 - Tổng hợp công phục vụ tính lương                            */
/* ------------------------------------------------------------------ */

export const buildPayrollReport = (
  logs: AttendanceLog[],
  employees: Employee[],
  filter: ReportFilter,
  config: WorkConfig
): PayrollRow[] => {
  // Mẫu tính lương luôn dùng dữ liệu của mọi máy, không lọc theo máy
  const days = computeMonth({
    logs,
    employees,
    config,
    from: filter.from,
    to: filter.to,
    machineId: 'all',
    dedupeSeconds: filter.dedupeSeconds
  }).filter(d => matches(d.department, d.code, d.name, filter));

  return summarizePayroll(days, config, filter.from, filter.to);
};
