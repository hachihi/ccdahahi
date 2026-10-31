import React, { useState, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit,
  Camera,
  HardDrive,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  CloudDownload,
  ArrowRight,
  Eye,
  Check,
  X,
  UserCheck,
  UserX,
  RotateCcw
} from 'lucide-react';
import { Employee, HachihiMachine, ConnectionSettings, employeeNeedsAttention } from '../types/hachihi';
import { useAuth } from '../context/AuthContext';
import {
  HachihiDataService,
  shrinkImage,
  downloadFaceImage,
  downloadCsv,
  parseCsv
} from '../services/hachihiService';
import { FaceCameraModal } from './FaceCameraModal';

interface EmployeesViewProps {
  employees: Employee[];
  machines: HachihiMachine[];
  settings: ConnectionSettings;
  onRefreshData: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  machines,
  settings,
  onRefreshData,
  showToast
}) => {
  const { hasPermission } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const bulkPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMachine, setFilterMachine] = useState<string>('all');
  const [filterFace, setFilterFace] = useState<'all' | 'hasPhoto' | 'noPhoto'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<Record<string, string>[]>([]);
  const [previewFaceModal, setPreviewFaceModal] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formId, setFormId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formMachines, setFormMachines] = useState<string[]>([]);
  const [formPhoto, setFormPhoto] = useState<string>('');
  const [pullingFaceId, setPullingFaceId] = useState<string | null>(null);

  const canManageEmployees = hasPermission('manage_employees');
  const canManageFaces = hasPermission('manage_faces');

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const matchSearch =
      (emp.id + emp.name + (emp.code || '') + (emp.department || '')).toLowerCase().includes(searchTerm.toLowerCase());
    const matchMachine = filterMachine === 'all' || emp.machines.includes(filterMachine);
    const matchFace =
      filterFace === 'all' ||
      (filterFace === 'hasPhoto' && (emp.hasPhoto || !!emp.photo)) ||
      (filterFace === 'noPhoto' && !emp.hasPhoto && !emp.photo);
    return matchSearch && matchMachine && matchFace;
  });

  // Open Create/Edit modal
  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setFormId(emp.id);
      setFormCode(emp.code || `EMP${emp.id}`);
      setFormName(emp.name);
      setFormDepartment(emp.department || '');
      setFormPosition(emp.position || '');
      setFormPhone(emp.phone || '');
      setFormEmail(emp.email || '');
      setFormFrom(emp.from || '');
      setFormTo(emp.to || '');
      setFormMachines(emp.machines || []);
      setFormPhoto(emp.photo || '');
    } else {
      setEditingEmp(null);
      // Auto suggest next numeric id
      const maxId = employees.reduce((max, e) => {
        const n = parseInt(e.id, 10);
        return !isNaN(n) && n > max ? n : max;
      }, 100);
      const nextId = String(maxId + 1);
      setFormId(nextId);
      setFormCode(`EMP${nextId}`);
      setFormName('');
      setFormDepartment('');
      setFormPosition('');
      setFormPhone('');
      setFormEmail('');
      setFormFrom('');
      setFormTo('');
      setFormMachines(machines.map(m => m.MachineBoxId));
      setFormPhoto('');
    }
    setIsModalOpen(true);
  };

  // Pull face photo for single employee
  const handlePullSingleFace = async (empId: string) => {
    setPullingFaceId(empId);
    showToast(`Đang tải ảnh Face ID cho nhân viên #${empId}...`, 'info');
    try {
      const res = await HachihiDataService.pullFaceForEmployee(empId, filterMachine !== 'all' ? filterMachine : undefined);
      if (res && res.ok) {
        onRefreshData();
        showToast(res.message || 'Đã tải thành công ảnh Face ID', 'success');
      } else {
        showToast(res?.error || 'Không tải được ảnh Face ID từ thiết bị/cloud', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setPullingFaceId(null);
    }
  };

  // Handle single photo upload from file picker
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await shrinkImage(file);
      setFormPhoto(optimized);
      showToast('Đã tối ưu hóa ảnh khuôn mặt theo chuẩn nén Hachihi', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi đọc tệp ảnh', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Save Employee (Creates locally and pushes to machine via /api/employees)
  const handleSaveEmployee = async () => {
    if (!formId.trim()) {
      showToast('Vui lòng nhập Mã nhân viên (ID thiết bị)', 'error');
      return;
    }
    if (!formName.trim()) {
      showToast('Vui lòng nhập Họ và tên nhân viên', 'error');
      return;
    }
    if (formName.length > 32) {
      showToast('Họ tên không được vượt quá 32 ký tự theo chuẩn máy Hachihi', 'error');
      return;
    }

    const payload: Partial<Employee> = {
      id: formId.trim(),
      code: formCode.trim() || `EMP${formId.trim()}`,
      name: formName.trim(),
      department: formDepartment.trim(),
      position: formPosition.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      from: formFrom,
      to: formTo,
      machines: formMachines,
      photo: formPhoto,
      hasPhoto: !!formPhoto,
      registeredFace: !!formPhoto
    };

    setIsLoading(true);
    try {
      const res = await HachihiDataService.saveEmployee(payload);
      if (res && res.ok) {
        onRefreshData();
        setIsModalOpen(false);
        if (res.failedMachines && res.failedMachines.length > 0) {
          showToast(res.warn || `Đã lưu nhưng đẩy lên máy thất bại ở ${res.failedMachines.length} máy. Bấm "Đẩy lại" để thử lại.`, 'error');
        } else if (res.pushResults && Object.keys(res.pushResults).length > 0) {
          const successCount = Object.values(res.pushResults).filter(v => v === 'OK').length;
          showToast(`Đã lưu và đẩy nhân sự lên ${successCount}/${formMachines.length} máy`, 'success');
        } else {
          showToast(res.warn || 'Đã lưu thông tin nhân viên thành công', 'success');
        }
      } else {
        showToast(res?.error || 'Lỗi khi lưu nhân viên', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu thông tin', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Employee: chỉ xóa hẳn khi mọi máy đã xác nhận
  const handleDeleteEmployee = async (emp: Employee) => {
    if (!confirm(`Bạn có chắc muốn xóa nhân viên "${emp.name}" (Mã: ${emp.id}) khỏi hệ thống và máy chấm công?`)) {
      return;
    }
    setIsLoading(true);
    try {
      let res = await HachihiDataService.deleteEmployee(emp.id);
      if (res && res.ok && res.pending) {
        const detail = Object.entries(res.machineResults || {})
          .filter(([, v]) => v !== 'OK')
          .map(([m, v]) => `- ${machines.find(x => x.MachineBoxId === m)?.MachineName || m}: ${v}`)
          .join('\n');
        const forceIt = confirm(
          `Chưa xóa được "${emp.name}" trên một số máy:\n${detail}\n\n` +
            'Bấm OK để vẫn xóa khỏi hệ thống (dữ liệu trên máy đó sẽ còn lại, cần xóa tay).\n' +
            'Bấm Hủy để giữ ở trạng thái "Chờ xóa" và thử lại sau.'
        );
        if (forceIt) {
          res = await HachihiDataService.deleteEmployee(emp.id, true);
        }
      }
      onRefreshData();
      if (res && res.ok && res.deleted) {
        showToast(
          res.forced
            ? `Đã xóa ${emp.name} khỏi hệ thống. Cần xóa tay trên máy chưa xóa được.`
            : `Đã xóa nhân viên ${emp.name} khỏi hệ thống và máy chấm công`,
          res.forced ? 'info' : 'success'
        );
      } else if (res && res.ok && res.pending) {
        showToast(`${emp.name} đang ở trạng thái "Chờ xóa" trên máy. Bấm "Đẩy lại" khi máy sẵn sàng.`, 'info');
      } else {
        showToast(res?.error || 'Lỗi khi xóa nhân viên', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi xóa nhân viên', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Thử lại các mục chưa đồng bộ của một nhân viên
  const handleRetryOne = async (emp: Employee) => {
    setIsLoading(true);
    try {
      const res = await HachihiDataService.retryEmployee(emp.id);
      onRefreshData();
      if (!res.ok) showToast(res.error || 'Không thể thử lại', 'error');
      else if (res.deleted) showToast(`Đã xóa ${emp.name} trên mọi máy`, 'success');
      else if (res.stillFailing) showToast(`${emp.name}: vẫn còn máy chưa đồng bộ được. Kiểm tra kết nối máy rồi thử lại.`, 'error');
      else showToast(`Đã đồng bộ ${emp.name} lên máy thành công`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi thử lại', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Thử lại hàng loạt theo lô cho tới khi hết hoặc không tiến triển
  const handleRetryAll = async () => {
    setIsLoading(true);
    try {
      let lastRemaining = Infinity;
      let remaining = 0;
      for (let round = 0; round < 20; round++) {
        const res = await HachihiDataService.retryFailedEmployees(15);
        if (!res.ok) {
          showToast(res.error || 'Không thể thử lại', 'error');
          break;
        }
        remaining = res.remaining ?? 0;
        if (remaining === 0 || remaining >= lastRemaining) break;
        lastRemaining = remaining;
      }
      onRefreshData();
      showToast(
        remaining === 0 ? 'Đã đồng bộ xong tất cả mục lỗi' : `Còn ${remaining} nhân viên chưa đồng bộ được. Kiểm tra kết nối máy rồi thử lại.`,
        remaining === 0 ? 'success' : 'error'
      );
    } catch (err: any) {
      showToast(err.message || 'Lỗi thử lại', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Push Employee & Face to device manually
  const handlePushToDevice = async (emp: Employee) => {
    if (!emp.photo) {
      showToast(`Nhân viên ${emp.name} chưa có ảnh khuôn mặt để đẩy lên máy`, 'error');
      return;
    }
    if (emp.machines.length === 0) {
      showToast('Chưa phân bổ máy chấm công cho nhân viên này', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await HachihiDataService.saveEmployee(emp);
      if (res && res.ok && res.failedMachines && res.failedMachines.length > 0) {
        onRefreshData();
        showToast(`Đẩy ${emp.name} thất bại ở ${res.failedMachines.length} máy: ${Object.values(res.pushResults || {}).filter(v => v !== 'OK')[0] || 'lỗi không rõ'}`, 'error');
      } else if (res && res.ok) {
        onRefreshData();
        showToast(`Đã nạp ảnh khuôn mặt của ${emp.name} lên thiết bị máy chấm công thành công!`, 'success');
      } else {
        showToast(res?.error || 'Lỗi đẩy lên máy', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi đẩy lên máy: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Download / Pull all employees and faces directly from machine
  const handlePullFromMachine = async () => {
    if (machines.length === 0) {
      showToast('Chưa có máy chấm công nào được kết nối. Vui lòng kết nối máy trước.', 'error');
      return;
    }
    const targetBox = filterMachine !== 'all' ? filterMachine : machines[0].MachineBoxId;
    setIsLoading(true);
    showToast(`Đang tải danh sách & Face ID từ máy ${targetBox}...`, 'info');
    try {
      const res = await HachihiDataService.pullEmployeesFromMachine(targetBox);
      if (res && res.ok) {
        onRefreshData();
        showToast(res.message || `Đã tải về ${res.count} nhân sự`, 'success');
      } else {
        showToast(res?.error || 'Lỗi tải danh sách từ máy', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối máy', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Download / Pull from Cloud Hachihi API v2.0
  const handlePullFromCloud = async () => {
    setIsLoading(true);
    showToast('Đang tải danh sách nhân sự từ Cloud Hachihi (API v2.0.0)...', 'info');
    try {
      const res = await HachihiDataService.pullEmployeesFromCloud();
      if (res && res.ok) {
        onRefreshData();
        showToast(res.message || `Đã tải về ${res.count} nhân sự từ Cloud`, 'success');
      } else {
        showToast(res?.error || 'Lỗi tải danh sách từ Cloud Hachihi', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Mã NV (ID)',
      'Mã nhân viên',
      'Họ và tên',
      'Điện thoại',
      'Email',
      'Phòng ban',
      'Chức vụ',
      'Đã có ảnh Face ID',
      'Từ ngày',
      'Đến ngày',
      'Danh sách máy'
    ];
    const rows = employees.map(e => [
      e.id,
      e.code || '',
      e.name,
      e.phone || '',
      e.email || '',
      e.department || '',
      e.position || '',
      e.hasPhoto || !!e.photo ? 'Có' : 'Chưa',
      e.from || '',
      e.to || '',
      e.machines.join('|')
    ]);
    downloadCsv('danh_sach_nhan_vien_hachihi.csv', headers, rows);
    showToast(`Đã xuất ${employees.length} nhân viên ra file CSV`, 'success');
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const headers = ['id', 'code', 'name', 'department', 'position', 'from', 'to', 'machines'];
    const rows = [
      ['101', 'EMP101', 'Nguyễn Văn An', 'Ban Giám Đốc', 'Giám đốc', '2026-01-01', '2028-12-31', machines[0]?.MachineBoxId || '1468063'],
      ['102', 'EMP102', 'Trần Thị Thảo', 'Phòng Nhân sự', 'Trưởng phòng', '', '', machines[0]?.MachineBoxId || '1468063']
    ];
    downloadCsv('mau_nhap_nhan_vien.csv', headers, rows);
  };

  // Handle CSV file selection
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const text = String(evt.target?.result || '');
      const parsed = parseCsv(text);
      if (parsed.rows.length === 0) {
        showToast('Tệp CSV trống hoặc không đúng định dạng', 'error');
        return;
      }
      setCsvPreviewData(parsed.rows);
      setIsImportCsvOpen(true);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // Execute Import CSV
  const handleExecuteImportCsv = async () => {
    setIsLoading(true);
    let count = 0;
    try {
      for (const row of csvPreviewData) {
        const id = row.id || row.manv || row.mãnv;
        const name = row.name || row.hoten || row.họvàtên;
        if (!id || !name) continue;

        const code = row.code || row.manhanvien || `EMP${id}`;
        const department = row.department || row.phongban || '';
        const position = row.position || row.chucvu || '';
        const from = row.from || row.tungay || '';
        const to = row.to || row.denngay || '';
        const machinesStr = row.machines || row.danhsachmay || '';
        const assignedMachines = machinesStr
          ? machinesStr.split('|').filter(Boolean)
          : machines.map(m => m.MachineBoxId);

        await HachihiDataService.saveEmployee({
          id,
          code,
          name,
          department,
          position,
          from,
          to,
          machines: assignedMachines
        });
        count++;
      }

      onRefreshData();
      setIsImportCsvOpen(false);
      setCsvPreviewData([]);
      showToast(`Đã tải lên thành công ${count} nhân viên. Hãy gán ảnh Face ID để đẩy lên máy.`, 'success');
    } catch (err: any) {
      showToast('Lỗi nhập CSV: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk Face Upload: filename = employee ID (e.g. 101.jpg, 102.png)
  const handleBulkPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
    let matched = 0;
    const skipped: string[] = [];

    const map = new Map(employees.map(emp => [emp.id, { ...emp }]));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '').trim();
      const targetEmp = map.get(filenameWithoutExt);

      if (targetEmp) {
        try {
          const optimizedPhoto = await shrinkImage(file);
          targetEmp.photo = optimizedPhoto;
          targetEmp.hasPhoto = true;
          targetEmp.registeredFace = true;
          // Save and push to Hachihi machine
          await HachihiDataService.saveEmployee(targetEmp);
          matched++;
        } catch {
          skipped.push(file.name);
        }
      } else {
        skipped.push(file.name);
      }
    }

    onRefreshData();
    setIsLoading(false);

    let message = `Đã nạp thành công ${matched} ảnh Face ID lên máy chấm công`;
    if (skipped.length > 0) {
      message += ` (Bỏ qua ${skipped.length} ảnh không khớp mã NV: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '...' : ''})`;
    }
    showToast(message, matched > 0 ? 'success' : 'info');
    if (e.target) e.target.value = '';
  };

  const attentionCount = employees.filter(employeeNeedsAttention).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner if no machine connected */}
      {machines.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Chưa có máy chấm công nào được kết nối. Hãy kết nối máy trước để thực hiện tải xuống danh sách, đẩy khuôn mặt và đồng bộ lịch sử.
            </span>
          </div>
        </div>
      )}

      {/* Cảnh báo nhân viên chưa đồng bộ đủ với máy */}
      {attentionCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              <b>{attentionCount} nhân viên</b> chưa đồng bộ đủ với máy chấm công (đẩy lỗi hoặc chờ xóa). Dữ liệu trên hệ thống và trên máy đang lệch nhau.
            </span>
          </div>
          <button
            onClick={handleRetryAll}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Đẩy lại các mục lỗi
          </button>
        </div>
      )}

      {/* Action Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm theo Mã NV, Họ tên, Phòng ban..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Machine Filter */}
          <select
            value={filterMachine}
            onChange={e => setFilterMachine(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tất cả thiết bị</option>
            {machines.map(m => (
              <option key={m.MachineBoxId} value={m.MachineBoxId}>
                {m.MachineName} ({m.MachineBoxId})
              </option>
            ))}
          </select>

          {/* Face Status Filter */}
          <select
            value={filterFace}
            onChange={e => setFilterFace(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tất cả trạng thái Face ID</option>
            <option value="hasPhoto">Đã có Face ID</option>
            <option value="noPhoto">Chưa có Face ID</option>
          </select>
        </div>

        {/* Buttons Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pull from Machine (Download employees & Face ID from device) */}
          <button
            onClick={handlePullFromMachine}
            disabled={isLoading || machines.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-teal-500/20 disabled:opacity-50 transition"
            title="Tải toàn bộ danh sách nhân viên và Face ID từ máy chấm công về ứng dụng"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Tải xuống từ máy
          </button>

          {/* Pull from Cloud v2.0 */}
          <button
            onClick={handlePullFromCloud}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium transition disabled:opacity-50"
            title="Lấy danh bạ từ Hachihi Cloud API v2.0"
          >
            <CloudDownload className="w-4 h-4 text-emerald-500" />
            Tải từ Cloud
          </button>

          {/* Add Employee */}
          {canManageEmployees && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              Thêm nhân viên
            </button>
          )}

          {/* Upload CSV */}
          {canManageEmployees && (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvFileSelected}
                className="hidden"
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition"
                title="Tải lên danh sách nhân viên từ tệp CSV"
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                Tải lên CSV
              </button>
            </>
          )}

          {/* Bulk Face ID Upload */}
          {canManageFaces && (
            <>
              <input
                ref={bulkPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkPhotos}
                className="hidden"
              />
              <button
                onClick={() => bulkPhotoInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition"
                title="Tải lên hàng loạt ảnh Face ID (Tên tệp = Mã NV)"
              >
                <ImageIcon className="w-4 h-4 text-blue-500" />
                Tải lên Face ID hàng loạt
              </button>
            </>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition"
            title="Tải file CSV danh sách nhân viên về máy"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3.5 pl-6 w-16">Face ID</th>
                <th className="py-3.5 px-4">Mã NV</th>
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-4">Phòng ban & Chức vụ</th>
                <th className="py-3.5 px-4">Máy chấm công</th>
                <th className="py-3.5 px-4">Hiệu lực</th>
                <th className="py-3.5 pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400 dark:text-slate-500">
                    <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-semibold text-base text-slate-700 dark:text-slate-300">
                      Chưa có nhân viên nào trong danh bạ
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Hãy bấm <strong>"Tải xuống từ máy"</strong> để kéo toàn bộ danh sách và Face ID từ máy chấm công về, hoặc bấm <strong>"Thêm nhân viên"</strong> / <strong>"Tải lên CSV"</strong>.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const hasPhoto = emp.hasPhoto || !!emp.photo;
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Avatar & Face Preview */}
                      <td className="py-3.5 pl-6">
                        <div className="relative group/avatar flex flex-col items-center">
                          {hasPhoto && emp.photo ? (
                            <button
                              onClick={() => setPreviewFaceModal(emp)}
                              className="relative block w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-emerald-500/30 hover:ring-emerald-500 transition shadow-sm"
                              title="Bấm để xem ảnh phóng to"
                            >
                              <img
                                src={emp.photo}
                                alt={emp.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition">
                                <Eye className="w-4 h-4" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xs">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          {hasPhoto && (
                            <span className="mt-1 inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold" title="Đã đăng ký Face ID trên hệ thống">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Face ID
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ID / Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          {emp.id}
                        </span>
                        {emp.code && emp.code !== emp.id && (
                          <span className="block text-[11px] text-slate-400 font-mono mt-0.5">
                            {emp.code}
                          </span>
                        )}
                      </td>

                      {/* Full Name */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                          {emp.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {emp.phone && <span>📞 {emp.phone}</span>}
                          {emp.email && <span>✉️ {emp.email}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {hasPhoto ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Đã có Face ID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              <AlertCircle className="w-3 h-3" /> Chưa có Face ID
                            </span>
                          )}
                          {emp.pendingDelete && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold" title="Đã yêu cầu xóa nhưng chưa xóa được trên mọi máy">
                              <AlertCircle className="w-3 h-3" /> Chờ xóa trên máy
                            </span>
                          )}
                          {!emp.pendingDelete && Object.values(emp.sync || {}).some((x: any) => x?.status === 'failed') && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold"
                              title={Object.entries(emp.sync || {})
                                .filter(([, x]: [string, any]) => x?.status === 'failed')
                                .map(([m, x]: [string, any]) => `${machines.find(y => y.MachineBoxId === m)?.MachineName || m}: ${x?.error || 'lỗi'}`)
                                .join('\n')}
                            >
                              <AlertCircle className="w-3 h-3" /> Lỗi đồng bộ {Object.values(emp.sync || {}).filter((x: any) => x?.status === 'failed').length} máy
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department & Position */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {emp.department || '—'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {emp.position || '—'}
                        </p>
                      </td>

                      {/* Machines */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.machines.length > 0 ? (
                            emp.machines.map(mId => {
                              const mObj = machines.find(m => m.MachineBoxId === mId);
                              return (
                                <span
                                  key={mId}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900"
                                  title={`Serial / MachineBoxId: ${mId}`}
                                >
                                  {mObj?.MachineName || mId}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa gán máy</span>
                          )}
                        </div>
                      </td>

                      {/* Validity Period */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {emp.from || emp.to ? (
                          <span>
                            {(emp.from || 'Bắt đầu').slice(0, 10)} &rarr; {(emp.to || 'Vô hạn').slice(0, 10)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Không giới hạn
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {employeeNeedsAttention(emp) && (
                            <button
                              onClick={() => handleRetryOne(emp)}
                              disabled={isLoading}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition disabled:opacity-50"
                              title="Đẩy lại các mục chưa đồng bộ lên máy chấm công"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Pull Face ID from machine / cloud button */}
                          <button
                            onClick={() => handlePullSingleFace(emp.id)}
                            disabled={pullingFaceId === emp.id}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition disabled:opacity-50"
                            title="Tải lại ảnh Face ID từ máy chấm công hoặc Cloud Hachihi"
                          >
                            <RefreshCw className={`w-4 h-4 ${pullingFaceId === emp.id ? 'animate-spin text-indigo-600' : ''}`} />
                          </button>

                          {/* Download Face Photo button */}
                          {hasPhoto && emp.photo && (
                            <button
                              onClick={() => downloadFaceImage(emp.photo!, emp.id, emp.name)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition"
                              title="Tải ảnh khuôn mặt (Face ID) về máy tính"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}

                          {/* Push Face ID to Device button */}
                          {canManageFaces && hasPhoto && (
                            <button
                              onClick={() => handlePushToDevice(emp)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
                              title="Đẩy ảnh Face ID và thông tin lên máy chấm công"
                            >
                              <HardDrive className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit */}
                          {canManageEmployees && (
                            <button
                              onClick={() => handleOpenModal(emp)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Chỉnh sửa thông tin"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          {canManageEmployees && (
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                              title="Xóa nhân viên khỏi hệ thống & thiết bị"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit Employee */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {editingEmp ? 'Chỉnh sửa nhân viên & Face ID' : 'Thêm mới nhân viên & Face ID'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Khai báo thông tin & nạp ảnh khuôn mặt chuẩn máy chấm công Hachihi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Photo Upload Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 ring-2 ring-emerald-500/30 shrink-0 flex items-center justify-center">
                  {formPhoto ? (
                    <img src={formPhoto} alt="Face ID" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Ảnh khuôn mặt (Face ID)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Hệ thống tự động nén về &le;480px JPEG để nạp vào ROM máy Hachihi.
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Chụp Webcam
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Chọn tệp ảnh
                    </button>

                    {formPhoto && (
                      <button
                        type="button"
                        onClick={() => setFormPhoto('')}
                        className="px-2 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs font-medium transition"
                      >
                        Gỡ ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã nhân viên (FacePersonId trên máy) *
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={e => setFormId(e.target.value)}
                    disabled={!!editingEmp}
                    placeholder="Ví dụ: 101, 102..."
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Định danh duy nhất trên phần cứng thiết bị.
                  </p>
                </div>

                {/* Employee Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã hồ sơ (EmployeeCode)
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="Ví dụ: EMP101"
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên nhân viên *
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Nguyễn Văn An (Tối đa 32 ký tự)"
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Tên sẽ hiển thị trên màn hình LCD máy khi quẹt mặt</span>
                    <span>{formName.length}/32 ký tự</span>
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phòng ban
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={e => setFormDepartment(e.target.value)}
                    placeholder="Phòng Kỹ thuật, Nhân sự..."
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chức vụ
                  </label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={e => setFormPosition(e.target.value)}
                    placeholder="Trưởng phòng, Chuyên viên..."
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="090..."
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="nhanvien@congty.com"
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Valid From */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Được phép quẹt thẻ từ ngày
                  </label>
                  <input
                    type="date"
                    value={formFrom.slice(0, 10)}
                    onChange={e => setFormFrom(e.target.value ? `${e.target.value} 00:00:00` : '')}
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Valid To */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Đến ngày (Để trống = vô hạn)
                  </label>
                  <input
                    type="date"
                    value={formTo.slice(0, 10)}
                    onChange={e => setFormTo(e.target.value ? `${e.target.value} 23:59:59` : '')}
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Assign Machines */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phân bổ máy chấm công được phép checkin
                </label>
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {machines.length === 0 ? (
                    <p className="text-xs text-amber-500">Chưa có máy nào được kết nối.</p>
                  ) : (
                    machines.map(m => {
                      const isChecked = formMachines.includes(m.MachineBoxId);
                      return (
                        <label
                          key={m.MachineBoxId}
                          className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setFormMachines([...formMachines, m.MachineBoxId]);
                              } else {
                                setFormMachines(formMachines.filter(id => id !== m.MachineBoxId));
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-medium">{m.MachineName}</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            (Serial: {m.MachineBoxId})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleSaveEmployee}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isLoading ? 'Đang lưu & đẩy lên máy...' : 'Lưu và nạp vào máy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Face Preview & Details */}
      {previewFaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden text-center p-6">
            <div className="relative w-48 h-48 mx-auto rounded-3xl overflow-hidden ring-4 ring-emerald-500/30 shadow-xl mb-4">
              <img
                src={previewFaceModal.photo}
                alt={previewFaceModal.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {previewFaceModal.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Mã NV: {previewFaceModal.id} {previewFaceModal.code ? `• ${previewFaceModal.code}` : ''}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              {previewFaceModal.department || '—'} • {previewFaceModal.position || 'Nhân viên'}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  downloadFaceImage(previewFaceModal.photo!, previewFaceModal.id, previewFaceModal.name);
                  showToast('Đang tải ảnh về máy tính', 'success');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition"
              >
                <Download className="w-4 h-4" />
                Tải ảnh về PC
              </button>
              <button
                onClick={() => setPreviewFaceModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CSV Import Preview */}
      {isImportCsvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Xem trước danh sách nhập từ CSV ({csvPreviewData.length} dòng)
                </h3>
              </div>
              <button
                onClick={() => setIsImportCsvOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-slate-500">
                  Dữ liệu sẽ được tự động đồng bộ vào danh sách nhân sự:
                </span>
                <button
                  onClick={handleDownloadSampleCsv}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Tải file CSV mẫu
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Họ tên</th>
                      <th className="p-2.5">Phòng ban</th>
                      <th className="p-2.5">Chức vụ</th>
                      <th className="p-2.5">Thiết bị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {csvPreviewData.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {row.id || row.manv || '—'}
                        </td>
                        <td className="p-2.5 font-medium">{row.name || row.hoten || '—'}</td>
                        <td className="p-2.5 text-slate-500">{row.department || row.phongban || '—'}</td>
                        <td className="p-2.5 text-slate-500">{row.position || row.chucvu || '—'}</td>
                        <td className="p-2.5 text-slate-500">{row.machines || 'Tất cả'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvPreviewData.length > 10 && (
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  ... và còn {csvPreviewData.length - 10} nhân viên khác
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <button
                onClick={() => setIsImportCsvOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteImportCsv}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
              >
                {isLoading ? 'Đang nhập...' : `Xác nhận nhập ${csvPreviewData.length} nhân viên`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Webcam Modal */}
      <FaceCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        employeeName={formName || formId}
        onCapture={base64Photo => {
          setFormPhoto(base64Photo);
          showToast('Đã chụp và tối ưu hóa ảnh Face ID từ Webcam', 'success');
        }}
      />
    </div>
  );
};
