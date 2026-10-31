import React, { useMemo, useRef, useState } from 'react';
import { Clock, Plus, Trash2, Download, Upload, Moon, CalendarDays, Users, Settings2 } from 'lucide-react';
import { Employee } from '../types/hachihi';
import { LeaveType, Shift, WorkConfig, parseWorkConfig, shiftSpan, uid } from '../services/workConfig';
import { formatDateVi, todayVN } from '../services/timeUtils';

interface Props {
  config: WorkConfig;
  setConfig: (c: WorkConfig) => void;
  employees: Employee[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const inputCls =
  'px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500';
const cardCls =
  'bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4';
const btnCls =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition';
const WEEKDAYS = [
  { v: 1, l: 'Thứ 2' },
  { v: 2, l: 'Thứ 3' },
  { v: 3, l: 'Thứ 4' },
  { v: 4, l: 'Thứ 5' },
  { v: 5, l: 'Thứ 6' },
  { v: 6, l: 'Thứ 7' },
  { v: 0, l: 'Chủ nhật' }
];

const Title: React.FC<{ icon: React.ReactNode; title: string; hint?: string }> = ({ icon, title, hint }) => (
  <div>
    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const WorkConfigView: React.FC<Props> = ({ config, setConfig, employees, showToast }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [leave, setLeave] = useState<{ pid: string; from: string; to: string; type: LeaveType; note: string }>({
    pid: '',
    from: todayVN(),
    to: todayVN(),
    type: 'paid',
    note: ''
  });
  const [overridePid, setOverridePid] = useState('');
  const [year, setYear] = useState(todayVN().slice(0, 4));

  const patch = (p: Partial<WorkConfig>) => setConfig({ ...config, ...p });
  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department || 'Chung'))).sort(),
    [employees]
  );
  const empName = (pid: string) => {
    const e = employees.find(x => x.id === pid);
    return e ? `${e.code || e.id} - ${e.name}` : pid;
  };

  /* ---------- Ca làm việc ---------- */
  const updateShift = (id: string, p: Partial<Shift>) =>
    patch({ shifts: config.shifts.map(s => (s.id === id ? { ...s, ...p } : s)) });

  const addShift = () => {
    const id = uid();
    patch({
      shifts: [
        ...config.shifts,
        {
          id,
          code: `CA${config.shifts.length + 1}`,
          name: 'Ca mới',
          start: '08:00',
          end: '17:00',
          breakStart: '12:00',
          breakMinutes: 60,
          lateGraceMinutes: 0,
          earlyGraceMinutes: 0
        }
      ]
    });
  };

  const removeShift = (id: string) => {
    if (config.shifts.length <= 1) {
      showToast('Cần giữ lại ít nhất một ca làm việc.', 'error');
      return;
    }
    const shifts = config.shifts.filter(s => s.id !== id);
    const clean = (m: Record<string, string>) =>
      Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id));
    patch({
      shifts,
      defaultShiftId: config.defaultShiftId === id ? shifts[0].id : config.defaultShiftId,
      deptShift: clean(config.deptShift),
      empShift: clean(config.empShift)
    });
  };

  /* ---------- Ngày lễ ---------- */
  const addHoliday = (date: string, name: string) => {
    if (!date || !name.trim()) {
      showToast('Hãy nhập ngày và tên ngày lễ.', 'error');
      return false;
    }
    if (config.holidays.some(h => h.date === date)) {
      showToast(`Ngày ${formatDateVi(date)} đã có trong danh sách.`, 'info');
      return false;
    }
    patch({ holidays: [...config.holidays, { id: uid(), date, name: name.trim() }] });
    return true;
  };

  const addFixedHolidays = () => {
    const fixed = [
      [`${year}-01-01`, 'Tết Dương lịch'],
      [`${year}-04-30`, 'Ngày Giải phóng miền Nam'],
      [`${year}-05-01`, 'Quốc tế Lao động'],
      [`${year}-09-02`, 'Quốc khánh']
    ];
    const existing = new Set(config.holidays.map(h => h.date));
    const add = fixed.filter(([d]) => !existing.has(d));
    patch({ holidays: [...config.holidays, ...add.map(([date, name]) => ({ id: uid(), date, name }))] });
    showToast(`Đã thêm ${add.length} ngày lễ cố định của năm ${year}.`, 'success');
  };

  /* ---------- Nghỉ phép ---------- */
  const addLeave = () => {
    if (!leave.pid || !leave.from || !leave.to) {
      showToast('Hãy chọn nhân viên và khoảng ngày nghỉ.', 'error');
      return;
    }
    if (leave.to < leave.from) {
      showToast('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.', 'error');
      return;
    }
    patch({ leaves: [...config.leaves, { id: uid(), ...leave }] });
    setLeave({ ...leave, note: '' });
  };

  /* ---------- Sao lưu ---------- */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cau_hinh_cong_${todayVN()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    const cfg = parseWorkConfig(await file.text());
    if (!cfg) {
      showToast('File không đúng định dạng cấu hình công của hệ thống.', 'error');
    } else {
      setConfig(cfg);
      showToast('Đã nhập cấu hình công.', 'success');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const sortedLeaves = [...config.leaves].sort((a, b) => b.from.localeCompare(a.from));
  const sortedHolidays = [...config.holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      {/* Ca làm việc */}
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <Title
            icon={<Clock className="w-4 h-4 text-emerald-500" />}
            title="Ca làm việc"
            hint="Ca qua đêm: đặt giờ ra nhỏ hơn hoặc bằng giờ vào (ví dụ 22:00 – 06:00). Công của ca đêm tính cho ngày bắt đầu ca."
          />
          <button onClick={addShift} className={btnCls}>
            <Plus className="w-3.5 h-3.5" /> Thêm ca
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 text-left">
                {['Mặc định', 'Mã ca', 'Tên ca', 'Giờ vào', 'Giờ ra', 'Nghỉ từ', 'Phút nghỉ', 'Cho trễ (phút)', 'Cho sớm (phút)', 'Giờ chuẩn', ''].map(
                  h => (
                    <th key={h} className="py-2 px-2 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {config.shifts.map(s => {
                const span = shiftSpan(s);
                return (
                  <tr key={s.id}>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name="defaultShift"
                        checked={config.defaultShiftId === s.id}
                        onChange={() => patch({ defaultShiftId: s.id })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input className={`${inputCls} w-16`} value={s.code} onChange={e => updateShift(s.id, { code: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={`${inputCls} w-32`} value={s.name} onChange={e => updateShift(s.id, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="time" className={inputCls} value={s.start} onChange={e => updateShift(s.id, { start: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="time" className={inputCls} value={s.end} onChange={e => updateShift(s.id, { end: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="time" className={inputCls} value={s.breakStart} onChange={e => updateShift(s.id, { breakStart: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} max={240} className={`${inputCls} w-16`} value={s.breakMinutes} onChange={e => updateShift(s.id, { breakMinutes: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} max={120} className={`${inputCls} w-16`} value={s.lateGraceMinutes} onChange={e => updateShift(s.id, { lateGraceMinutes: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} max={120} className={`${inputCls} w-16`} value={s.earlyGraceMinutes} onChange={e => updateShift(s.id, { earlyGraceMinutes: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400">
                      {(span.standardMinutes / 60).toFixed(2)} giờ
                      {span.overnight && (
                        <span className="ml-2 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                          <Moon className="w-3 h-3" /> Ca đêm
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeShift(s.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg" title="Xóa ca">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân ca */}
      <div className={cardCls}>
        <Title
          icon={<Users className="w-4 h-4 text-blue-500" />}
          title="Phân ca cho nhân viên"
          hint="Thứ tự ưu tiên: cấu hình riêng cho nhân viên, rồi đến theo phòng ban, cuối cùng là ca mặc định."
        />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Theo phòng ban</p>
            {departments.length === 0 && <p className="text-xs text-slate-400">Chưa có nhân viên nào. Hãy đồng bộ danh sách từ máy.</p>}
            {departments.map(d => (
              <div key={d} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-700 dark:text-slate-300">{d}</span>
                <select
                  className={inputCls}
                  value={config.deptShift[d] || ''}
                  onChange={e => {
                    const next = { ...config.deptShift };
                    if (e.target.value) next[d] = e.target.value;
                    else delete next[d];
                    patch({ deptShift: next });
                  }}
                >
                  <option value="">Ca mặc định</option>
                  {config.shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.start}–{s.end})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Riêng từng nhân viên</p>
            <div className="flex gap-2 flex-wrap">
              <select className={`${inputCls} max-w-[220px]`} value={overridePid} onChange={e => setOverridePid(e.target.value)}>
                <option value="">Chọn nhân viên…</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.code || e.id} - {e.name}
                  </option>
                ))}
              </select>
              <button
                className={btnCls}
                onClick={() => {
                  if (!overridePid) return;
                  patch({ empShift: { ...config.empShift, [overridePid]: config.defaultShiftId } });
                  setOverridePid('');
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Thêm
              </button>
            </div>
            {Object.keys(config.empShift).length === 0 && <p className="text-xs text-slate-400">Chưa có nhân viên nào được cấu hình riêng.</p>}
            {Object.entries(config.empShift).map(([pid, sid]) => (
              <div key={pid} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{empName(pid)}</span>
                <div className="flex items-center gap-1">
                  <select className={inputCls} value={sid} onChange={e => patch({ empShift: { ...config.empShift, [pid]: e.target.value } })}>
                    {config.shifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} ({s.start}–{s.end})
                      </option>
                    ))}
                  </select>
                  <button
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
                    onClick={() => {
                      const next = { ...config.empShift };
                      delete next[pid];
                      patch({ empShift: next });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ngày nghỉ & lễ */}
      <div className={cardCls}>
        <Title
          icon={<CalendarDays className="w-4 h-4 text-amber-500" />}
          title="Ngày nghỉ hàng tuần và ngày lễ"
          hint="Ngày lễ hưởng lương được tính 1 công lễ nếu không trùng ngày nghỉ hàng tuần. Tết Âm lịch và Giỗ Tổ thay đổi theo từng năm, hãy thêm theo thông báo chính thức."
        />
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map(w => (
            <label key={w.v} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={config.weeklyOff.includes(w.v)}
                onChange={e =>
                  patch({
                    weeklyOff: e.target.checked ? [...config.weeklyOff, w.v] : config.weeklyOff.filter(x => x !== w.v)
                  })
                }
              />
              {w.l}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <input type="date" className={inputCls} value={holiday.date} onChange={e => setHoliday({ ...holiday, date: e.target.value })} />
          <input className={`${inputCls} w-56`} placeholder="Tên ngày lễ" value={holiday.name} onChange={e => setHoliday({ ...holiday, name: e.target.value })} />
          <button
            className={btnCls}
            onClick={() => {
              if (addHoliday(holiday.date, holiday.name)) setHoliday({ date: '', name: '' });
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Thêm ngày lễ
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <input type="number" className={`${inputCls} w-20`} value={year} onChange={e => setYear(e.target.value)} />
          <button className={btnCls} onClick={addFixedHolidays}>
            Thêm lễ cố định (1/1, 30/4, 1/5, 2/9)
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {sortedHolidays.length === 0 && <p className="text-xs text-slate-400">Chưa có ngày lễ nào.</p>}
          {sortedHolidays.map(h => (
            <span key={h.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              {formatDateVi(h.date)} · {h.name}
              <button onClick={() => patch({ holidays: config.holidays.filter(x => x.id !== h.id) })} title="Xóa">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Nghỉ phép */}
      <div className={cardCls}>
        <Title
          icon={<Users className="w-4 h-4 text-rose-500" />}
          title="Nghỉ phép và nghỉ không lương"
          hint="Nghỉ phép được tính 1 công phép mỗi ngày làm việc. Ngày nghỉ hàng tuần và ngày lễ nằm trong khoảng nghỉ không bị tính thêm."
        />
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${inputCls} max-w-[220px]`} value={leave.pid} onChange={e => setLeave({ ...leave, pid: e.target.value })}>
            <option value="">Chọn nhân viên…</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.code || e.id} - {e.name}
              </option>
            ))}
          </select>
          <input type="date" className={inputCls} value={leave.from} onChange={e => setLeave({ ...leave, from: e.target.value, to: leave.to < e.target.value ? e.target.value : leave.to })} />
          <span className="text-xs text-slate-500">đến</span>
          <input type="date" className={inputCls} value={leave.to} onChange={e => setLeave({ ...leave, to: e.target.value })} />
          <select className={inputCls} value={leave.type} onChange={e => setLeave({ ...leave, type: e.target.value as LeaveType })}>
            <option value="paid">Nghỉ phép (hưởng lương)</option>
            <option value="unpaid">Nghỉ không lương</option>
          </select>
          <input className={`${inputCls} w-44`} placeholder="Ghi chú / lý do" value={leave.note} onChange={e => setLeave({ ...leave, note: e.target.value })} />
          <button className={btnCls} onClick={addLeave}>
            <Plus className="w-3.5 h-3.5" /> Thêm
          </button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {sortedLeaves.length === 0 && <p className="text-xs text-slate-400">Chưa ghi nhận lượt nghỉ nào.</p>}
          {sortedLeaves.map(l => (
            <div key={l.id} className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-800 dark:text-slate-200 truncate">
                <b>{empName(l.pid)}</b> · {formatDateVi(l.from)}
                {l.to !== l.from && ` – ${formatDateVi(l.to)}`} ·{' '}
                <span className={l.type === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}>
                  {l.type === 'paid' ? 'Nghỉ phép' : 'Nghỉ không lương'}
                </span>
                {l.note && ` · ${l.note}`}
              </span>
              <button className="text-rose-500 shrink-0" onClick={() => patch({ leaves: config.leaves.filter(x => x.id !== l.id) })} title="Xóa">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quy tắc tính công */}
      <div className={cardCls}>
        <Title icon={<Settings2 className="w-4 h-4 text-violet-500" />} title="Quy tắc tính công và tăng ca" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Công mỗi ngày
            <select className={inputCls} value={config.rules.rounding} onChange={e => patch({ rules: { ...config.rules, rounding: e.target.value as 'none' | 'half' } })}>
              <option value="none">Theo tỷ lệ giờ thực tế (vd 0,83)</option>
              <option value="half">Làm tròn xuống 0,5 công</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={config.rules.otEnabled} onChange={e => patch({ rules: { ...config.rules, otEnabled: e.target.checked } })} />
            Tính tăng ca từ dữ liệu chấm công
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tối thiểu
            <input type="number" min={0} className={`${inputCls} w-16`} disabled={!config.rules.otEnabled} value={config.rules.otMinMinutes} onChange={e => patch({ rules: { ...config.rules, otMinMinutes: Number(e.target.value) || 0 } })} />
            phút
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Làm tròn xuống theo
            <input type="number" min={0} className={`${inputCls} w-16`} disabled={!config.rules.otEnabled} value={config.rules.otStepMinutes} onChange={e => patch({ rules: { ...config.rules, otStepMinutes: Number(e.target.value) || 0 } })} />
            phút
          </label>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Tăng ca ở đây tính theo thời gian có mặt ngoài ca, <b>chưa qua duyệt</b>. Nên đối chiếu với phiếu đăng ký tăng ca trước khi tính lương.
        </p>
      </div>

      {/* Sao lưu */}
      <div className={cardCls}>
        <Title
          icon={<Download className="w-4 h-4 text-slate-500" />}
          title="Sao lưu cấu hình"
          hint="Cấu hình hiện được lưu trong trình duyệt này. Hãy tải bản sao lưu sau khi chỉnh sửa, và dùng nó để nạp lại khi đổi máy hoặc xóa dữ liệu trình duyệt."
        />
        <div className="flex gap-2">
          <button className={btnCls} onClick={exportJson}>
            <Download className="w-3.5 h-3.5" /> Tải bản sao lưu (.json)
          </button>
          <button className={btnCls} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> Nhập từ file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => importJson(e.target.files?.[0])} />
        </div>
      </div>
    </div>
  );
};
