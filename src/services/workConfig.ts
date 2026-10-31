import { Employee } from '../types/hachihi';
import { overlap, toMins } from './timeUtils';

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu cấu hình công                                          */
/* ------------------------------------------------------------------ */

export interface Shift {
  id: string;
  code: string; // Mã ca: HC, CD...
  name: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm" - nếu <= start thì là ca qua đêm
  breakStart: string; // giờ bắt đầu nghỉ giữa ca
  breakMinutes: number;
  lateGraceMinutes: number; // đi trễ trong ngưỡng này không bị tính trễ
  earlyGraceMinutes: number; // về sớm trong ngưỡng này không bị tính sớm
}

export type LeaveType = 'paid' | 'unpaid';

export interface LeaveEntry {
  id: string;
  pid: string; // Employee.id
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  type: LeaveType; // paid = nghỉ phép hưởng lương, unpaid = nghỉ không lương
  note: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface WorkRules {
  rounding: 'none' | 'half'; // none: giữ tỷ lệ chính xác, half: làm tròn xuống bội số 0,5 công
  otEnabled: boolean;
  otMinMinutes: number; // dưới ngưỡng này không tính tăng ca
  otStepMinutes: number; // làm tròn xuống theo bước này
}

export interface WorkConfig {
  version: 1;
  shifts: Shift[];
  defaultShiftId: string;
  deptShift: Record<string, string>; // phòng ban -> shiftId
  empShift: Record<string, string>; // Employee.id -> shiftId (ưu tiên cao nhất)
  weeklyOff: number[]; // 0 = CN ... 6 = T7
  holidays: Holiday[];
  leaves: LeaveEntry[];
  rules: WorkRules;
}

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export const makeDefaultConfig = (start = '08:30', end = '17:30'): WorkConfig => {
  const id = uid();
  return {
    version: 1,
    shifts: [
      {
        id,
        code: 'HC',
        name: 'Hành chính',
        start,
        end,
        breakStart: '12:00',
        breakMinutes: 60,
        lateGraceMinutes: 0,
        earlyGraceMinutes: 0
      }
    ],
    defaultShiftId: id,
    deptShift: {},
    empShift: {},
    weeklyOff: [0],
    holidays: [],
    leaves: [],
    rules: { rounding: 'none', otEnabled: false, otMinMinutes: 30, otStepMinutes: 30 }
  };
};

/* ------------------------------------------------------------------ */
/* Lưu trữ (tách riêng để sau này đổi sang API / cơ sở dữ liệu)         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'hachihi_work_config_v1';

export const loadWorkConfig = (fallbackStart?: string, fallbackEnd?: string): WorkConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkConfig;
      if (parsed && parsed.version === 1 && parsed.shifts?.length) return parsed;
    }
  } catch {
    /* dữ liệu hỏng -> dùng mặc định */
  }
  return makeDefaultConfig(fallbackStart, fallbackEnd);
};

export const saveWorkConfig = (cfg: WorkConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* trình duyệt chặn lưu */
  }
};

/** Kiểm tra và chuẩn hóa file JSON người dùng nhập vào. Trả về null nếu không hợp lệ. */
export const parseWorkConfig = (text: string): WorkConfig | null => {
  try {
    const c = JSON.parse(text) as Partial<WorkConfig>;
    if (!c || c.version !== 1 || !Array.isArray(c.shifts) || c.shifts.length === 0) return null;
    const base = makeDefaultConfig();
    return {
      ...base,
      ...c,
      rules: { ...base.rules, ...(c.rules || {}) },
      deptShift: c.deptShift || {},
      empShift: c.empShift || {},
      weeklyOff: Array.isArray(c.weeklyOff) ? c.weeklyOff : base.weeklyOff,
      holidays: c.holidays || [],
      leaves: c.leaves || [],
      defaultShiftId: c.shifts.some(s => s.id === c.defaultShiftId) ? c.defaultShiftId! : c.shifts[0].id
    } as WorkConfig;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Tính toán theo ca                                                   */
/* ------------------------------------------------------------------ */

export interface ShiftSpan {
  startMin: number; // phút từ 00:00 ngày làm việc
  endMin: number; // giờ ra (time-of-day), dùng để nhận biết lượt chấm ra của ca đêm
  endAbs: number; // có thể > 1440 nếu ca qua đêm
  breakStartAbs: number;
  breakEndAbs: number;
  overnight: boolean;
  standardMinutes: number; // số phút làm việc chuẩn (đã trừ nghỉ giữa ca)
}

export const shiftSpan = (s: Shift): ShiftSpan => {
  const startMin = toMins(s.start);
  const endMin = toMins(s.end);
  const overnight = endMin <= startMin;
  const endAbs = overnight ? endMin + 1440 : endMin;
  let bs = toMins(s.breakStart);
  if (overnight && bs < startMin) bs += 1440;
  const be = bs + Math.max(0, s.breakMinutes);
  const standardMinutes = Math.max(0, endAbs - startMin - overlap(startMin, endAbs, bs, be));
  return { startMin, endMin, endAbs, breakStartAbs: bs, breakEndAbs: be, overnight, standardMinutes };
};

/** Ca của nhân viên: cấu hình riêng > theo phòng ban > ca mặc định */
export const resolveShift = (emp: Pick<Employee, 'id' | 'department'>, cfg: WorkConfig): Shift => {
  const byId = (id?: string) => (id ? cfg.shifts.find(s => s.id === id) : undefined);
  return (
    byId(cfg.empShift[emp.id]) ||
    byId(cfg.deptShift[emp.department || 'Chung']) ||
    byId(cfg.defaultShiftId) ||
    cfg.shifts[0]
  );
};
