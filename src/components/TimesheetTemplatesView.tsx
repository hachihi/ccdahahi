import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Sliders,
  Layers,
  Download,
  Eye,
  EyeOff,
  Copy,
  Star,
  Check
} from 'lucide-react';
import { TimesheetTemplate, TimesheetColumnConfig } from '../types/dahahi';
import { DahahiDataService, downloadCsv } from '../services/dahahiService';
import { useAuth } from '../context/AuthContext';

interface TimesheetTemplatesViewProps {
  onSelectTemplate?: (templateId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TimesheetTemplatesView: React.FC<TimesheetTemplatesViewProps> = ({
  onSelectTemplate,
  showToast
}) => {
  const { currentUser, hasPermission } = useAuth();
  const canEdit = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || hasPermission('manage_devices');

  const [templates, setTemplates] = useState<TimesheetTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TimesheetTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await DahahiDataService.getTimesheetTemplates();
      setTemplates(data);
    } catch (err: any) {
      showToast('Lỗi tải danh sách mẫu bảng công: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleToggleColumn = (colKey: string) => {
    if (!editingTemplate) return;
    const updatedCols = editingTemplate.columns.map(c =>
      c.key === colKey ? { ...c, visible: !c.visible } : c
    );
    setEditingTemplate({ ...editingTemplate, columns: updatedCols });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim()) {
      showToast('Vui lòng nhập tên mẫu bảng công', 'error');
      return;
    }

    const res = await DahahiDataService.saveTimesheetTemplate(editingTemplate);
    if (res.ok && res.templates) {
      setTemplates(res.templates);
      setIsModalOpen(false);
      setEditingTemplate(null);
      showToast('Đã lưu cấu hình mẫu bảng công thành công', 'success');
    } else {
      showToast(res.error || 'Lỗi khi lưu mẫu bảng công', 'error');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!canEdit) {
      showToast('Bạn không có quyền xóa mẫu', 'error');
      return;
    }
    const res = await DahahiDataService.deleteTimesheetTemplate(id);
    if (res.ok && res.templates) {
      setTemplates(res.templates);
      showToast('Đã xóa mẫu bảng công', 'success');
    } else {
      showToast(res.error || 'Lỗi khi xóa mẫu', 'error');
    }
  };

  const handleSetDefault = async (tpl: TimesheetTemplate) => {
    const updated = { ...tpl, isDefault: true };
    const res = await DahahiDataService.saveTimesheetTemplate(updated);
    if (res.ok && res.templates) {
      setTemplates(res.templates);
      showToast(`Đã đặt "${tpl.name}" làm mẫu xuất mặc định`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-slate-100 dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-slate-900 border border-teal-200/60 dark:border-teal-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
              Module 7
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Mẫu Bảng Công & Xuất Excel
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Tùy biến cột hiển thị, tạo mẫu chuyên nghiệp theo ca, theo máy hoặc ma trận tháng, lưu template cho kế toán và nhân sự
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              const newTpl: TimesheetTemplate = {
                id: `tpl-${Date.now()}`,
                name: 'Mẫu bảng công tùy biến mới',
                description: 'Tùy chỉnh các cột theo yêu cầu doanh nghiệp',
                baseType: 'shift_detail',
                isDefault: false,
                createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
                columns: [
                  { key: 'stt', label: 'STT', visible: true, order: 1 },
                  { key: 'employeeCode', label: 'Mã NV', visible: true, order: 2 },
                  { key: 'employeeName', label: 'Họ và tên', visible: true, order: 3 },
                  { key: 'department', label: 'Phòng ban', visible: true, order: 4 },
                  { key: 'date', label: 'Ngày', visible: true, order: 5 },
                  { key: 'minIn', label: 'Vào Sớm Nhất (MIN)', visible: true, order: 6 },
                  { key: 'maxOut', label: 'Ra Muộn Nhất (MAX)', visible: true, order: 7 },
                  { key: 'shiftCode', label: 'Mã Ca', visible: true, order: 8 },
                  { key: 'standardIn', label: 'Giờ Vào Chuẩn', visible: true, order: 9 },
                  { key: 'standardOut', label: 'Giờ Ra Chuẩn', visible: true, order: 10 },
                  { key: 'lateMinutes', label: 'Phút vào Trễ', visible: true, order: 11 },
                  { key: 'earlyMinutes', label: 'Phút về Sớm', visible: true, order: 12 },
                  { key: 'workHours', label: 'Giờ công', visible: true, order: 13 }
                ]
              };
              setEditingTemplate(newTpl);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium shadow-md shadow-teal-600/20 transition self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Tạo mẫu bảng công mới
          </button>
        )}
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map(tpl => (
          <div
            key={tpl.id}
            className={`p-5 rounded-2xl border transition relative flex flex-col justify-between ${
              tpl.isDefault
                ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-300 dark:border-teal-800 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  {tpl.baseType === 'device_detail' && 'Mẫu theo máy'}
                  {tpl.baseType === 'shift_detail' && 'Mẫu theo ca'}
                  {tpl.baseType === 'monthly_matrix' && 'Mẫu ma trận tháng'}
                </span>

                <div className="flex items-center gap-1">
                  {tpl.isDefault ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-100/60 dark:bg-teal-950 px-2 py-0.5 rounded-md">
                      <Star className="w-3.5 h-3.5 fill-current" /> Mặc định
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(tpl)}
                      className="text-xs text-slate-400 hover:text-teal-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Đặt làm mẫu mặc định"
                    >
                      Đặt mặc định
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1">
                {tpl.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                {tpl.description}
              </p>

              {/* Columns preview */}
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Cột dữ liệu ({tpl.columns.filter(c => c.visible).length}/{tpl.columns.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.columns.map(c => (
                    <span
                      key={c.key}
                      className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                        c.visible
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-400 line-through border-slate-200/50 dark:border-slate-800'
                      }`}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Tạo lúc: {tpl.createdAt?.slice(0, 10) || 'Hệ thống'}
              </span>

              <div className="flex items-center gap-1.5">
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Chỉnh sửa cột"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                {canEdit && !tpl.id.startsWith('tpl-device-') && !tpl.id.startsWith('tpl-shift-') && !tpl.id.startsWith('tpl-monthly-') && (
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Xóa mẫu này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Column Modal */}
      {isModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-teal-500" />
                Cấu hình Mẫu bảng công: {editingTemplate.name}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTemplate(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tên mẫu bảng công *
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={editingTemplate.description}
                  onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Bật / Tắt các cột hiển thị khi xem và xuất Excel:
                </label>
                <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 max-h-60 overflow-y-auto">
                  {editingTemplate.columns.map(col => (
                    <div
                      key={col.key}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleColumn(col.key)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                            col.visible
                              ? 'bg-teal-600 text-white'
                              : 'border border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {col.visible && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <span className={`text-sm font-medium ${col.visible ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 line-through'}`}>
                          {col.label}
                        </span>
                      </div>

                      <input
                        type="text"
                        value={col.label}
                        onChange={e => {
                          const updated = editingTemplate.columns.map(c =>
                            c.key === col.key ? { ...c, label: e.target.value } : c
                          );
                          setEditingTemplate({ ...editingTemplate, columns: updated });
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-w-[140px]"
                        placeholder="Đổi tên cột"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md transition"
              >
                Lưu mẫu bảng công
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
