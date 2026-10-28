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
