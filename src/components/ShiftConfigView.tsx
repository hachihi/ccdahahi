import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Calendar,
  Building2,
  AlertTriangle,
  Layers,
  Save,
  RotateCcw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { ShiftConfig, Employee } from '../types/dahahi';
import { DahahiDataService } from '../services/dahahiService';
import { useAuth } from '../context/AuthContext';

interface ShiftConfigViewProps {
  employees: Employee[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ShiftConfigView: React.FC<ShiftConfigViewProps> = ({
  employees,
  showToast
}) => {
  const { hasPermission, currentUser } = useAuth();
  const canManageShifts = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || hasPermission('manage_devices');

  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<ShiftConfig> | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Weekend & Holiday policies
  const [weekendWorkPolicy, setWeekendWorkPolicy] = useState<'off' | 'saturday_half' | 'all_days'>('saturday_half');

  // Available departments in the company
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department?.trim()) set.add(e.department.trim());
    });
    return Array.from(set);
  }, [employees]);

  const loadShifts = async () => {
    setLoading(true);
    try {
      const data = await DahahiDataService.getShifts();
      setShifts(data);
    } catch (err: any) {
      showToast('Lỗi tải danh sách ca: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const handleSaveShift = async (shiftToSave: Partial<ShiftConfig>) => {
    if (!canManageShifts) {
      showToast('Bạn không có quyền chỉnh sửa ca làm việc (Yêu cầu Super Admin hoặc HR Manager)', 'error');
      return;
    }

    if (!shiftToSave.code || !shiftToSave.name || !shiftToSave.startTime || !shiftToSave.endTime) {
      showToast('Vui lòng điền đầy đủ Mã ca, Tên ca, Giờ bắt đầu và Giờ kết thúc', 'error');
      return;
    }

    const payload: ShiftConfig = {
      code: shiftToSave.code.toUpperCase().trim(),
      name: shiftToSave.name.trim(),
      startTime: shiftToSave.startTime,
      endTime: shiftToSave.endTime,
      breakStart: shiftToSave.breakStart || '12:00',
      breakEnd: shiftToSave.breakEnd || '13:00',
      graceLateMinutes: Number(shiftToSave.graceLateMinutes) || 15,
      graceEarlyMinutes: Number(shiftToSave.graceEarlyMinutes) || 15,
      overtimeAfterMinutes: Number(shiftToSave.overtimeAfterMinutes) || 30,
      standardWorkHours: Number(shiftToSave.standardWorkHours) || 8.0,
      isDefault: !!shiftToSave.isDefault,
      applicableDepartments: shiftToSave.applicableDepartments || []
    };

    const res = await DahahiDataService.saveShift(payload);
    if (res.ok && res.shifts) {
      setShifts(res.shifts);
      setEditingShift(null);
      setIsNewModalOpen(false);
      showToast(`Đã lưu thành công ca ${payload.code}`, 'success');
    } else {
      showToast(res.error || 'Lỗi khi lưu ca làm việc', 'error');
    }
  };

  const handleDeleteShift = async (code: string) => {
    if (!canManageShifts) {
      showToast('Bạn không có quyền xóa ca làm việc', 'error');
      return;
    }
    if (code === 'HC') {
      showToast('Không thể xóa ca Hành chính mặc định', 'error');
      return;
    }
    const res = await DahahiDataService.deleteShift(code);
    if (res.ok && res.shifts) {
      setShifts(res.shifts);
      showToast(`Đã xóa ca ${code}`, 'success');
    } else {
      showToast(res.error || 'Lỗi khi xóa ca', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-slate-100 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-slate-900 border border-emerald-200/60 dark:border-emerald-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500 text-white">
              Module 6
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Cấu hình Tính công & Ca làm việc
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Thiết lập giờ chuẩn, khung giờ linh hoạt, phút cho phép trễ/sớm, tăng ca và phân ca theo phòng ban
          </p>
        </div>

        {canManageShifts && (
          <button
            onClick={() => {
              setEditingShift({
                code: '',
                name: '',
                startTime: '08:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                graceLateMinutes: 15,
                graceEarlyMinutes: 15,
                overtimeAfterMinutes: 30,
                standardWorkHours: 8.0,
                isDefault: false,
                applicableDepartments: []
              });
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-600/20 transition self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Thêm ca làm việc mới
          </button>
        )}
      </div>

      {/* Grid of Shifts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {shifts.map(shift => (
          <div
            key={shift.code}
            className={`rounded-2xl border p-5 transition relative flex flex-col justify-between ${
              shift.isDefault
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-900 text-white dark:bg-slate-800">
                    {shift.code}
                  </span>
                  {shift.isDefault && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      Ca mặc định
                    </span>
                  )}
                </div>

                {canManageShifts && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingShift(shift);
                        setIsNewModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Chỉnh sửa ca"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!shift.isDefault && (
                      <button
                        onClick={() => handleDeleteShift(shift.code)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Xóa ca này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-2">
                {shift.name}
              </h3>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5" /> Giờ làm việc:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {shift.startTime} - {shift.endTime}
                  </span>
                </div>

                {shift.breakStart && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Nghỉ trưa / giữa ca:</span>
                    <span className="font-medium">
                      {shift.breakStart} - {shift.breakEnd}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Cho phép vào trễ / về sớm:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    ±{shift.graceLateMinutes || 15} phút
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Tính tăng ca (OT) sau:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    +{shift.overtimeAfterMinutes || 30} phút
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Công chuẩn:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {shift.standardWorkHours || 8.0} giờ / ngày
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1.5">Phòng ban áp dụng:</span>
              <div className="flex flex-wrap gap-1">
                {shift.applicableDepartments && shift.applicableDepartments.length > 0 ? (
                  shift.applicableDepartments.map(dept => (
                    <span
                      key={dept}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      {dept}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Áp dụng toàn công ty</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Weekend Policy Setting */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          Chế độ làm việc cuối tuần & Ngày nghỉ lễ
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Quy định tính công ngày Thứ Bảy và Chủ Nhật cho toàn thể nhân sự
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'saturday_half', title: 'Thứ 7 làm nửa ngày (Sáng)', desc: 'Chủ nhật nghỉ, Thứ 7 tính 0.5 công' },
            { id: 'off', title: 'Nghỉ trọn vẹn T7 & CN', desc: 'Chỉ chấm công từ Thứ 2 đến Thứ 6' },
            { id: 'all_days', title: 'Làm việc cả tuần (Ca luân phiên)', desc: 'Tính công theo ca thực tế mỗi ngày' }
          ].map(p => (
            <label
              key={p.id}
              className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                weekendWorkPolicy === p.id
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="weekendPolicy"
                checked={weekendWorkPolicy === p.id}
                onChange={() => {
                  setWeekendWorkPolicy(p.id as any);
                  showToast('Đã lưu cấu hình làm việc cuối tuần', 'success');
                }}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Edit / Create Shift Modal */}
      {isNewModalOpen && editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                {editingShift.code ? `Cập nhật ca: ${editingShift.code}` : 'Thêm ca làm việc mới'}
              </h3>
              <button
                onClick={() => {
                  setIsNewModalOpen(false);
                  setEditingShift(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mã ca (Viết tắt) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. HC, CA1, OT"
                  value={editingShift.code || ''}
                  onChange={e => setEditingShift({ ...editingShift, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tên hiển thị ca làm *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ca Hành chính"
                  value={editingShift.name || ''}
                  onChange={e => setEditingShift({ ...editingShift, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Giờ vào ca (Bắt đầu) *
                </label>
                <input
                  type="time"
                  value={editingShift.startTime || '08:00'}
                  onChange={e => setEditingShift({ ...editingShift, startTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Giờ ra ca (Kết thúc) *
                </label>
                <input
                  type="time"
                  value={editingShift.endTime || '17:00'}
                  onChange={e => setEditingShift({ ...editingShift, endTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Bắt đầu nghỉ giữa ca
                </label>
                <input
                  type="time"
                  value={editingShift.breakStart || '12:00'}
                  onChange={e => setEditingShift({ ...editingShift, breakStart: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Kết thúc nghỉ giữa ca
                </label>
                <input
                  type="time"
                  value={editingShift.breakEnd || '13:00'}
                  onChange={e => setEditingShift({ ...editingShift, breakEnd: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Cho phép vào trễ (phút)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={editingShift.graceLateMinutes || 15}
                  onChange={e => setEditingShift({ ...editingShift, graceLateMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Cho phép về sớm (phút)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={editingShift.graceEarlyMinutes || 15}
                  onChange={e => setEditingShift({ ...editingShift, graceEarlyMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tính OT sau giờ tan (phút)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={editingShift.overtimeAfterMinutes || 30}
                  onChange={e => setEditingShift({ ...editingShift, overtimeAfterMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Công chuẩn (giờ)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={editingShift.standardWorkHours || 8.0}
                  onChange={e => setEditingShift({ ...editingShift, standardWorkHours: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            {/* Department selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Áp dụng cho các phòng ban (Để trống nếu áp dụng tất cả):
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
                {departments.map(dept => {
                  const isChecked = (editingShift.applicableDepartments || []).includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        const cur = editingShift.applicableDepartments || [];
                        const next = isChecked ? cur.filter(x => x !== dept) : [...cur, dept];
                        setEditingShift({ ...editingShift, applicableDepartments: next });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                        isChecked
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {dept}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsNewModalOpen(false);
                  setEditingShift(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSaveShift(editingShift)}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
              >
                Lưu cấu hình ca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
