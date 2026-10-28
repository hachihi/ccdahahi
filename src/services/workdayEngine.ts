import { AttendanceLog, Employee } from '../types/dahahi';
import { Shift, WorkConfig, resolveShift, shiftSpan } from './workConfig';
import { addDays, daysOfMonth, fmtAbs, overlap, todayVN, weekdayOf } from './timeUtils';

/** Lượt chấm sau giờ ra của ca đêm trong khoảng này vẫn thuộc ngày làm việc hôm trước */
const OVERNIGHT_CUTOFF_AFTER_END = 180;

export type DayType = 'work' | 'off' | 'holiday' | 'leave_paid' | 'leave_unpaid';

export interface DayResult {
  pid: string;
  code: string;
  name: string;
  department: string;
  date: string; // ngày làm việc (ca đêm tính theo ngày bắt đầu ca)
  dayType: DayType;
  isWeeklyOff: boolean;
  holidayName: string;
  shift: Shift;
  punchCount: number;
  single: boolean; // chỉ có 1 lượt chấm -> không đủ vào/ra
  firstIn: string;
  lastOut: string;
  lateMin: number;
  earlyMin: number;
  workMinutes: number; // phút làm việc thực tế trong ca, đã trừ nghỉ giữa ca
  cong: number; // công ngày (0..1), chỉ tính cho ngày làm việc
  otMin: number; // phút tăng ca (nếu bật tính tăng ca)
  note: string;
}

/* ------------------------------------------------------------------ */
/* Lọc trùng                                                           */
/* ------------------------------------------------------------------ */

const secOf = (t: string): number => {
  const [h, m, s] = t.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/** Bỏ các lượt chấm trùng liên tiếp của cùng nhân viên + cùng máy trong N giây. `sorted` phải sắp theo thời gian. */
export const dedupeLogs = (sorted: AttendanceLog[], seconds: number): AttendanceLog[] => {
  if (seconds <= 0) return sorted;
  const last = new Map<string, number>();
  const out: AttendanceLog[] = [];
  for (const l of sorted) {
    const key = `${l.pid}|${l.m}|${l.time.slice(0, 10)}`;
    const s = secOf(l.time.slice(11, 19));
    const prev = last.get(key);
    if (prev !== undefined && s - prev < seconds) continue;
    last.set(key, s);
    out.push(l);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Tính công theo ngày                                                 */
/* ------------------------------------------------------------------ */

export interface ComputeParams {
  logs: AttendanceLog[];
  employees: Employee[];
  config: WorkConfig;
  month: string; // YYYY-MM
  machineId: string; // 'all' hoặc MachineBoxId
  dedupeSeconds: number;
  today?: string; // để test; mặc định là hôm nay theo giờ Việt Nam
}

const roundCong = (v: number, mode: 'none' | 'half'): number =>
  mode === 'half' ? Math.floor(v * 2 + 1e-9) / 2 : Math.round(v * 100) / 100;

const applyOtRule = (raw: number, min: number, step: number): number => {
  if (raw <= 0 || raw < min) return 0;
  return step > 0 ? Math.floor(raw / step) * step : raw;
};

export const computeMonth = (p: ComputeParams): DayResult[] => {
  const { config, month } = p;
  const days = daysOfMonth(month);
  const first = days[0];
  const last = days[days.length - 1];
  const lo = addDays(first, -1);
  const hi = addDays(last, 1);
  const today = p.today || todayVN();

  const empMap = new Map<string, Employee>(p.employees.map(e => [e.id, e]));

  const logs = dedupeLogs(
    p.logs
      .filter(l => l.time && l.time.slice(0, 10) >= lo && l.time.slice(0, 10) <= hi)
      .filter(l => p.machineId === 'all' || l.m === p.machineId)
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time)),
    p.dedupeSeconds
  );

  // Lượt chấm của mã chưa có trong danh sách nhân viên vẫn được đưa vào báo cáo
  for (const l of logs) {
    if (!empMap.has(l.pid)) empMap.set(l.pid, { id: l.pid, name: l.name, machines: [] });
  }

  // Gom lượt chấm theo (nhân viên, ngày làm việc), đổi sang phút tính từ 00:00 ngày làm việc
  const punches = new Map<string, number[]>();
  for (const l of logs) {
    const emp = empMap.get(l.pid)!;
    const span = shiftSpan(resolveShift(emp, config));
    const date = l.time.slice(0, 10);
    const t = Number(l.time.slice(11, 13)) * 60 + Number(l.time.slice(14, 16));
    let workDate = date;
    let abs = t;
    if (span.overnight && t <= span.endMin + OVERNIGHT_CUTOFF_AFTER_END) {
      workDate = addDays(date, -1);
      abs = t + 1440;
    }
    if (workDate < first || workDate > last) continue;
    const key = `${l.pid}|${workDate}`;
    const arr = punches.get(key);
    if (arr) arr.push(abs);
    else punches.set(key, [abs]);
  }

  const holidayMap = new Map(config.holidays.map(h => [h.date, h.name]));
  const leavesByPid = new Map<string, typeof config.leaves>();
  for (const lv of config.leaves) {
    const arr = leavesByPid.get(lv.pid);
    if (arr) arr.push(lv);
    else leavesByPid.set(lv.pid, [lv]);
  }

  const emps = Array.from(empMap.values()).sort((a, b) =>
    (a.code || a.id).localeCompare(b.code || b.id, undefined, { numeric: true })
  );

  const results: DayResult[] = [];
  for (const emp of emps) {
    const shift = resolveShift(emp, config);
    const span = shiftSpan(shift);

    for (const date of days) {
      if (date > today) break; // không đánh giá ngày chưa tới

      const isWeeklyOff = config.weeklyOff.includes(weekdayOf(date));
      const holidayName = holidayMap.get(date) || '';
      const leave = (leavesByPid.get(emp.id) || []).find(lv => date >= lv.from && date <= lv.to);

      let dayType: DayType = 'work';
      if (holidayName) dayType = 'holiday';
      else if (isWeeklyOff) dayType = 'off';
      else if (leave) dayType = leave.type === 'paid' ? 'leave_paid' : 'leave_unpaid';

      const list = (punches.get(`${emp.id}|${date}`) || []).sort((a, b) => a - b);
      const inAbs = list[0];
      const outAbs = list[list.length - 1];
      const single = list.length > 0 && (list.length === 1 || outAbs === inAbs);

      const r: DayResult = {
        pid: emp.id,
        code: emp.code || emp.id,
        name: emp.name || `(Mã NV: ${emp.id})`,
        department: emp.department || 'Chung',
        date,
        dayType,
        isWeeklyOff,
        holidayName,
        shift,
        punchCount: list.length,
        single,
        firstIn: list.length ? fmtAbs(inAbs) : '',
        lastOut: list.length && !single ? fmtAbs(outAbs) : '',
        lateMin: 0,
        earlyMin: 0,
        workMinutes: 0,
        cong: 0,
        otMin: 0,
        note: ''
      };

      const notes: string[] = [];
      if (dayType === 'holiday') notes.push(`Ngày lễ: ${holidayName}`);
      if (dayType === 'off') notes.push('Nghỉ hàng tuần');
      if (dayType === 'leave_paid') notes.push('Nghỉ phép');
      if (dayType === 'leave_unpaid') notes.push('Nghỉ không lương');
      if (list.length && (dayType === 'leave_paid' || dayType === 'leave_unpaid')) {
        notes.push('Có chấm công trong ngày nghỉ, cần kiểm tra');
      }

      if (list.length === 0) {
        if (dayType === 'work') notes.push('Chưa có dữ liệu chấm công');
      } else if (single) {
        notes.push('Chỉ có 1 lượt chấm');
      } else if (dayType === 'work') {
        const lateRaw = Math.max(0, inAbs - span.startMin);
        const earlyRaw = Math.max(0, span.endAbs - outAbs);
        r.lateMin = lateRaw > shift.lateGraceMinutes ? lateRaw : 0;
        r.earlyMin = earlyRaw > shift.earlyGraceMinutes ? earlyRaw : 0;

        const effIn = lateRaw <= shift.lateGraceMinutes ? span.startMin : Math.max(inAbs, span.startMin);
        const effOut = earlyRaw <= shift.earlyGraceMinutes ? span.endAbs : Math.min(outAbs, span.endAbs);
        r.workMinutes = Math.max(
          0,
          effOut - effIn - overlap(effIn, effOut, span.breakStartAbs, span.breakEndAbs)
        );
        r.cong =
          span.standardMinutes > 0
            ? roundCong(Math.min(1, r.workMinutes / span.standardMinutes), config.rules.rounding)
            : 0;

        if (config.rules.otEnabled) {
          r.otMin = applyOtRule(
            outAbs - span.endAbs,
            config.rules.otMinMinutes,
            config.rules.otStepMinutes
          );
        }
      } else if (dayType === 'off' || dayType === 'holiday') {
        // Đi làm vào ngày nghỉ / ngày lễ: toàn bộ thời gian có mặt (trừ nghỉ giữa ca) là tăng ca
        if (config.rules.otEnabled) {
          const present =
            outAbs - inAbs - overlap(inAbs, outAbs, span.breakStartAbs, span.breakEndAbs);
          r.otMin = applyOtRule(present, config.rules.otMinMinutes, config.rules.otStepMinutes);
        }
      }

      r.note = notes.join('; ');
      results.push(r);
    }
  }
  return results;
};

/* ------------------------------------------------------------------ */
/* Tổng hợp công phục vụ tính lương (Mẫu 5)                            */
/* ------------------------------------------------------------------ */

export interface PayrollRow {
  stt: number;
  pid: string;
  code: string;
  name: string;
  department: string;
  shiftCode: string;
  standardDays: number; // công chuẩn của tháng
  actual: number; // công thực tế
  leavePaid: number; // công phép
  holidayPaid: number; // công lễ
  paidTotal: number; // tổng công hưởng lương
  unpaidDays: number; // nghỉ không lương
  unconfirmedDays: number; // ngày làm việc chưa có dữ liệu chấm công
  incompleteDays: number; // ngày chỉ có 1 lượt chấm
  lateMin: number;
  earlyMin: number;
  otWeekday: number; // giờ
  otOff: number;
  otHoliday: number;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

export const summarizePayroll = (days: DayResult[], config: WorkConfig, month: string): PayrollRow[] => {
  const standardDays = daysOfMonth(month).filter(d => !config.weeklyOff.includes(weekdayOf(d))).length;
  const byPid = new Map<string, DayResult[]>();
  for (const d of days) {
    const arr = byPid.get(d.pid);
    if (arr) arr.push(d);
    else byPid.set(d.pid, [d]);
  }

  const rows: PayrollRow[] = [];
  for (const list of byPid.values()) {
    const f = list[0];
    let actual = 0, leavePaid = 0, holidayPaid = 0, unpaid = 0, unconfirmed = 0, incomplete = 0;
    let late = 0, early = 0, otW = 0, otO = 0, otH = 0;

    for (const d of list) {
      if (d.dayType === 'work') {
        actual += d.cong;
        if (d.punchCount === 0) unconfirmed++;
        late += d.lateMin;
        early += d.earlyMin;
        otW += d.otMin;
      } else if (d.dayType === 'leave_paid') leavePaid++;
      else if (d.dayType === 'leave_unpaid') unpaid++;
      else if (d.dayType === 'holiday' && !d.isWeeklyOff) holidayPaid++;
      if (d.dayType === 'off') otO += d.otMin;
      if (d.dayType === 'holiday') otH += d.otMin;
      if (d.single) incomplete++;
    }

    rows.push({
      stt: 0,
      pid: f.pid,
      code: f.code,
      name: f.name,
      department: f.department,
      shiftCode: f.shift.code,
      standardDays,
      actual: r2(actual),
      leavePaid,
      holidayPaid,
      paidTotal: r2(actual + leavePaid + holidayPaid),
      unpaidDays: unpaid,
      unconfirmedDays: unconfirmed,
      incompleteDays: incomplete,
      lateMin: late,
      earlyMin: early,
      otWeekday: r2(otW / 60),
      otOff: r2(otO / 60),
      otHoliday: r2(otH / 60)
    });
  }

  rows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  rows.forEach((r, i) => (r.stt = i + 1));
  return rows;
};
