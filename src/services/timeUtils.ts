/** Tiện ích ngày giờ dùng chung. Mọi ngày là chuỗi "YYYY-MM-DD", giờ là "HH:mm". */

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toMins = (t: string): number => {
  const [h, m] = (t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const overlap = (a1: number, a2: number, b1: number, b2: number): number =>
  Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/** Ngày hôm nay theo múi giờ Việt Nam, không phụ thuộc múi giờ máy chạy */
export const todayVN = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
};

/** Danh sách các ngày trong tháng "YYYY-MM" */
export const daysOfMonth = (month: string): string[] => {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${y}-${pad2(m)}-${pad2(i + 1)}`);
};

/** 0 = Chủ nhật ... 6 = Thứ bảy */
export const weekdayOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** "2026-10-27" -> "27/10/2026" */
export const formatDateVi = (iso: string): string => {
  const [y, m, d] = (iso || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/** Phút tính từ 00:00 ngày làm việc -> "HH:mm" (thêm "(+1)" nếu sang ngày hôm sau) */
export const fmtAbs = (mins: number): string => {
  const t = ((mins % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}${mins >= 1440 ? ' (+1)' : ''}`;
};

/* ------------------------------------------------------------------ */
/* Kỳ báo cáo: ngày / tuần / tháng / năm / tùy chọn                     */
/* ------------------------------------------------------------------ */

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
  year: 'Năm',
  custom: 'Tùy chọn'
};

/** Số ngày tối đa cho một báo cáo, để trình duyệt không bị quá tải */
export const MAX_RANGE_DAYS = 366;

/** Các ngày từ `from` đến `to` (gồm cả hai đầu) */
export const datesBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length <= 1000; d = addDays(d, 1)) out.push(d);
  return out;
};

export const daysBetweenCount = (from: string, to: string): number => datesBetween(from, to).length;

/** Thứ Hai đầu tuần (tuần Việt Nam bắt đầu từ thứ Hai) */
export const startOfWeek = (iso: string): string => {
  const wd = weekdayOf(iso); // 0 = CN
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
};

export const endOfWeek = (iso: string): string => addDays(startOfWeek(iso), 6);

export const endOfMonth = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  return `${y}-${pad2(m)}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};

export interface PeriodState {
  kind: PeriodKind;
  anchor: string; // một ngày bất kỳ trong kỳ (ngày / tuần / tháng / năm)
  customFrom: string;
  customTo: string;
}

export const rangeOfPeriod = (p: PeriodState): { from: string; to: string } => {
  const a = p.anchor;
  switch (p.kind) {
    case 'day':
      return { from: a, to: a };
    case 'week':
      return { from: startOfWeek(a), to: endOfWeek(a) };
    case 'month':
      return { from: `${a.slice(0, 7)}-01`, to: endOfMonth(a) };
    case 'year':
      return { from: `${a.slice(0, 4)}-01-01`, to: `${a.slice(0, 4)}-12-31` };
    default:
      return { from: p.customFrom, to: p.customTo };
  }
};

/** Chuyển sang kỳ trước (-1) hoặc kỳ sau (+1) */
export const shiftPeriod = (p: PeriodState, dir: -1 | 1): PeriodState => {
  const a = p.anchor;
  let anchor = a;
  if (p.kind === 'day') anchor = addDays(a, dir);
  else if (p.kind === 'week') anchor = addDays(a, 7 * dir);
  else if (p.kind === 'month') {
    const [y, m] = a.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + dir, 1));
    anchor = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-01`;
  } else if (p.kind === 'year') anchor = `${Number(a.slice(0, 4)) + dir}-01-01`;
  return { ...p, anchor };
};

/** Tên kỳ hiển thị trong tiêu đề báo cáo */
export const periodTitle = (kind: PeriodKind, from: string, to: string): string => {
  if (kind === 'day') return `Ngày ${formatDateVi(from)}`;
  if (kind === 'month') return `Tháng ${from.slice(5, 7)}/${from.slice(0, 4)}`;
  if (kind === 'year') return `Năm ${from.slice(0, 4)}`;
  return `Từ ${formatDateVi(from)} đến ${formatDateVi(to)}`;
};

/** Hậu tố tên file: 2026-10, 2026, 2026-10-05, 2026-10-05_2026-10-11 */
export const periodFileSuffix = (kind: PeriodKind, from: string, to: string): string => {
  if (kind === 'day') return from;
  if (kind === 'month') return from.slice(0, 7);
  if (kind === 'year') return from.slice(0, 4);
  return `${from}_${to}`;
};
