import { AttendanceLog, DahahiMachine, Employee } from '../types/dahahi';

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

export interface ShiftConfig {
  code: string; // Mã ca, vd: HC
  start: string; // Giờ vào chuẩn "HH:mm"
  end: string; // Giờ ra chuẩn "HH:mm"
  breakMinutes: number; // Thời gian nghỉ trưa (phút), trừ khỏi giờ công
  breakStart: string; // Giờ bắt đầu nghỉ trưa "HH:mm"
}

export interface ReportFilter {
  month: string; // "YYYY-MM"
  machineId: string; // "all" hoặc MachineBoxId
  department: string; // "all" hoặc tên phòng ban
  keyword: string; // tìm theo mã / tên
  dedupeSeconds: number; // bỏ lần chấm trùng trong N giây (0 = tắt)
}

/** Mẫu 1: mỗi dòng = 1 nhân viên + 1 ngày + 1 máy */
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

export const DEFAULT_SHIFT: ShiftConfig = {
  code: 'HC',
  start: '08:30',
  end: '17:30',
  breakMinutes: 60,
  breakStart: '12:00'
};

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */

export const toMins = (t: string): number => {
  const [h, m] = (t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const toSecs = (t: string): number => {
  const [h, m, s] = (t || '').split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/** "2026-10-27" -> "27/10/2026" */
export const formatDateVi = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const overlap = (a1: number, a2: number, b1: number, b2: number): number =>
  Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/** Lọc log theo tháng/máy, bỏ chấm trùng, nhóm theo nhân viên + ngày (+ máy) */
const collectLogs = (logs: AttendanceLog[], filter: ReportFilter) => {
  const sorted = logs
    .filter(l => l.time && l.time.startsWith(filter.month))
    .filter(l => filter.machineId === 'all' || l.m === filter.machineId)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));

  // Bỏ lần chấm trùng liên tiếp của cùng nhân viên (+ cùng máy) trong N giây
  const lastSeen = new Map<string, number>();
  const kept: AttendanceLog[] = [];
  for (const l of sorted) {
    const key = `${l.pid}|${l.m}|${l.time.slice(0, 10)}`;
    const secs = toSecs(l.time.slice(11, 19));
    const prev = lastSeen.get(key);
    if (filter.dedupeSeconds > 0 && prev !== undefined && secs - prev < filter.dedupeSeconds) {
      continue;
    }
    lastSeen.set(key, secs);
    kept.push(l);
  }
  return kept;
};

const matchesEmployee = (
  emp: Employee | undefined,
  pid: string,
  fallbackName: string,
  filter: ReportFilter
): boolean => {
  const dept = emp?.department || 'Chung';
  if (filter.department !== 'all' && dept !== filter.department) return false;
  const kw = filter.keyword.trim().toLowerCase();
  if (!kw) return true;
  const code = (emp?.code || pid).toLowerCase();
  const name = (emp?.name || fallbackName || '').toLowerCase();
  return code.includes(kw) || name.includes(kw);
};

/* ------------------------------------------------------------------ */
/* Mẫu 1 - Chi tiết theo máy                                           */
/* ------------------------------------------------------------------ */

export const buildMachineDetailReport = (
  logs: AttendanceLog[],
  employees: Employee[],
  machines: DahahiMachine[],
  filter: ReportFilter
): { rows: MachineDetailRow[]; maxPunches: number } => {
  const empMap = new Map(employees.map(e => [e.id, e]));
  const machineName = new Map(machines.map(m => [m.MachineBoxId, m.MachineName]));
  const groups = new Map<string, MachineDetailRow>();

  for (const l of collectLogs(logs, filter)) {
    const emp = empMap.get(l.pid);
    if (!matchesEmployee(emp, l.pid, l.name, filter)) continue;
    const date = l.time.slice(0, 10);
    const key = `${l.pid}|${date}|${l.m}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        code: emp?.code || l.pid,
        name: emp?.name || l.name || `(Mã NV: ${l.pid})`,
        date,
        machineId: l.m,
        machineName: machineName.get(l.m) || l.m || '—',
        punches: []
      };
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
  const maxPunches = rows.reduce((mx, r) => Math.max(mx, r.punches.length), 1);
  return { rows, maxPunches };
};

/* ------------------------------------------------------------------ */
/* Mẫu 2 - Báo cáo chấm công chi tiết                                  */
/* ------------------------------------------------------------------ */

export const buildDailyDetailReport = (
  logs: AttendanceLog[],
  employees: Employee[],
  filter: ReportFilter,
  shift: ShiftConfig
): DailyDetailRow[] => {
  const empMap = new Map(employees.map(e => [e.id, e]));
  const groups = new Map<string, { pid: string; name: string; date: string; times: string[] }>();

  for (const l of collectLogs(logs, filter)) {
    const emp = empMap.get(l.pid);
    if (!matchesEmployee(emp, l.pid, l.name, filter)) continue;
    const date = l.time.slice(0, 10);
    const key = `${l.pid}|${date}`;
    let g = groups.get(key);
    if (!g) {
      g = { pid: l.pid, name: l.name, date, times: [] };
      groups.set(key, g);
    }
    g.times.push(l.time.slice(11, 16)); // HH:mm
  }

  const stdIn = toMins(shift.start);
  const stdOut = toMins(shift.end);
  const brStart = toMins(shift.breakStart);
  const brEnd = brStart + Math.max(0, shift.breakMinutes);

  const rows: Omit<DailyDetailRow, 'stt'>[] = [];
  for (const g of groups.values()) {
    const emp = empMap.get(g.pid);
    g.times.sort();
    const firstIn = g.times[0];
    const lastOut = g.times[g.times.length - 1];
    const single = g.times.length === 1;

    let late = 0;
    let early = 0;
    let hours = 0;
    let note = '';

    late = Math.max(0, toMins(firstIn) - stdIn);
    if (single) {
      note = 'Thiếu giờ ra';
    } else {
      early = Math.max(0, stdOut - toMins(lastOut));
      // Giờ công = phần giờ nằm trong ca chuẩn, trừ thời gian nghỉ trưa
      const inShift = overlap(toMins(firstIn), toMins(lastOut), stdIn, stdOut);
      const inBreak = overlap(
        Math.max(toMins(firstIn), stdIn),
        Math.min(toMins(lastOut), stdOut),
        brStart,
        brEnd
      );
      hours = Math.round(((inShift - inBreak) / 60) * 100) / 100;
    }

    rows.push({
      code: emp?.code || g.pid,
      name: emp?.name || g.name || `(Mã NV: ${g.pid})`,
      department: emp?.department || 'Chung',
      date: g.date,
      firstIn,
      lastOut: single ? '' : lastOut,
      shiftCode: shift.code,
      stdIn: shift.start,
      stdOut: shift.end,
      lateMinutes: late,
      earlyMinutes: early,
      workHours: hours,
      note
    });
  }

  rows.sort(
    (a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }) || a.date.localeCompare(b.date)
  );
  return rows.map((r, i) => ({ stt: i + 1, ...r }));
};

/* ------------------------------------------------------------------ */
/* Xuất Excel (.xls dạng HTML - mở trực tiếp bằng Excel, giữ định dạng) */
/* ------------------------------------------------------------------ */

const esc = (v: string | number): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export interface ExcelSheetOptions {
  title: string; // dòng tiêu đề lớn
  subtitle: string; // dòng kỳ báo cáo / bộ lọc
  headers: string[];
  rows: (string | number)[][];
  /** Chỉ số cột (0-based) căn trái; mặc định căn giữa */
  leftAlignCols?: number[];
  /** Chỉ số cột chứa mã/giờ cần ép kiểu text để Excel không đổi định dạng */
  textCols?: number[];
}

export const downloadExcel = (filename: string, opt: ExcelSheetOptions) => {
  const cols = opt.headers.length;
  const left = new Set(opt.leftAlignCols || []);
  const text = new Set(opt.textCols || []);
  const border = 'border:1px solid #94a3b8;';

  const head = opt.headers
    .map(
      h =>
        `<th style="${border}background:#047857;color:#ffffff;font-weight:bold;text-align:center;vertical-align:middle;padding:6px;">${esc(h)}</th>`
    )
    .join('');

  const body = opt.rows
    .map((r, ri) => {
      const bg = ri % 2 === 1 ? 'background:#f1f5f9;' : '';
      const tds = r
        .map((c, ci) => {
          const align = left.has(ci) ? 'left' : 'center';
          const fmt = text.has(ci) ? 'mso-number-format:\'\\@\';' : '';
          return `<td style="${border}${bg}${fmt}text-align:${align};padding:4px;">${esc(c)}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Báo cáo</x:Name><x:WorksheetOptions><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>4</x:SplitHorizontal><x:TopRowBottomPane>4</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt;">
<tr><td colspan="${cols}" style="font-size:16pt;font-weight:bold;text-align:center;color:#065f46;">${esc(opt.title)}</td></tr>
<tr><td colspan="${cols}" style="text-align:center;font-style:italic;">${esc(opt.subtitle)}</td></tr>
<tr><td colspan="${cols}"></td></tr>
<tr>${head}</tr>
${body}
</table>
</body></html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
