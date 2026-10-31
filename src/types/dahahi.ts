export type RoleType = 'SUPER_ADMIN' | 'HR_MANAGER' | 'TECHNICIAN' | 'VIEWER' | 'CUSTOM';

export type ActiveTab =
  | 'dashboard'
  | 'employees'
  | 'devices'
  | 'logs'
  | 'report'
  | 'shifts'
  | 'templates'
  | 'users'
  | 'docs';

export type PermissionKey =

  | 'manage_devices'
  | 'manage_employees'
  | 'manage_faces'
  | 'sync_data'
  | 'view_reports'
  | 'manage_users'
  | 'danger_actions';

export interface UserPermission {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface UserRole {
  id: RoleType;
  name: string;
  description: string;
  badgeColor: string;
  permissions: PermissionKey[];
}

export interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: RoleType;
  customPermissions?: PermissionKey[];
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface DahahiMachine {
  MachineName: string;
  MachineCode: string;
  MachineBoxId: string;
  ip?: string;
  isOnline?: boolean;
  lastSeen?: string;
  employeeCount?: number;
}

export interface Employee {
  id: string; // FacePersonId or FacePersionId
  code?: string; // EmployeeCode (Mã NV)
  name: string; // FullName
  department?: string; // Phòng ban
  position?: string; // Chức vụ
  phone?: string;
  email?: string;
  photo?: string; // Base64 image
  hasPhoto?: boolean;
  from?: string; // BeginTime / FromTimeStr
  to?: string; // EndTime / ToTimeStr
  machines: string[]; // List of MachineBoxId assigned
  registeredFace?: boolean;
  createdAt?: string;
}

export interface AttendanceLog {
  id: string;
  pid: string; // FacePersonId
  name: string;
  time: string; // YYYY-MM-DD HH:mm:ss
  m: string; // MachineBoxId
  temp?: number | null; // Temperature (°C)
  similarity?: number;
  snapImage?: string; // Base64 image
}

export interface MonthlyReportRow {
  pid: string;
  name: string;
  department?: string;
  days: Record<string, [string, string]>; // day -> [first_in, last_out]
  workDays: number;
  hours: number;
  late: number;
}

export interface AutoSyncConfig {
  enabled: boolean;
  intervalMinutes: number; // e.g. 1, 2, 5, 10, 15, 30
  syncLogs: boolean; // Tự động tải lịch sử checkin
  syncHeartbeat: boolean; // Tự động kiểm tra online máy
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'error' | 'idle' | 'running';
  lastSyncMessage?: string;
  lastSyncAdded?: number;
}

export interface ConnectionSettings {
  host: string; // e.g. https://ten_mien.dahahi.vn
  appKey: string; // default k77hcPwEXB4LTdJv96mz
  secretKey: string;
  serial: string; // Machine serial / MachineBoxId
  workStartTime: string; // e.g. 08:30
  workEndTime: string; // e.g. 17:30
  callbackCheckinUrl: string;
  callbackHeartbeatUrl: string;
  autoSync?: AutoSyncConfig;
}

export interface SyncRecord {
  id: string;
  fromMachine: string;
  toMachine: string;
  total: number;
  totalRegistered: number;
  status: 0 | 1 | 2 | 3; // 0: chờ xử lý, 1: đang xử lý, 2: thành công, 3: lỗi
  createdAt: string;
}

export interface ApiDocItem {
  id: string;
  stt: number;
  name: string;
  url: string;
  method: 'POST' | 'GET';
  description: string;
  headers: Record<string, string>;
  inputParams: { field: string; type: string; required: boolean; description: string; sample: string }[];
  outputParams: { field: string; type: string; description: string; sample: string }[];
  errorCodes?: { code: string; message: string }[];
}

export interface SavedDeviceProfile {
  id: string;
  name: string;
  host: string;
  secretKey: string;
  appKey: string;
  serial: string;
  isConnected?: boolean;
  lastConnected?: string;
  notes?: string;
}

// Mẫu 1: Báo cáo chấm công chi tiết theo máy (cứ mỗi lần chấm trong ngày là thêm 1 cột)
export interface DeviceDetailReportRow {
  employeeCode: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  machine: string; // Tên máy hoặc BoxId
  punches: string[]; // ['08:02:15', '12:01:10', '13:00:22', ...]
}

// Mẫu 2: Báo cáo chấm công chi tiết theo ca (MIN, MAX, Ca, Vào Chuẩn, Ra Chuẩn, Phút Trễ, Phút Sớm, Giờ công)
export interface DetailedShiftReportRow {
  stt: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD
  minIn: string; // Vào Sớm Nhất (MIN)
  maxOut: string; // Ra Muộn Nhất (MAX)
  shiftCode: string; // Mã Ca (e.g. HC)
  standardIn: string; // Giờ Vào Chuẩn
  standardOut: string; // Giờ Ra Chuẩn
  lateMinutes: number; // Phút vào Trễ
  earlyMinutes: number; // Phút về Sớm
  workHours: number; // Giờ công
  overtimeHours?: number; // Giờ tăng ca
}

// Module 6: Cấu hình tính công & ca làm việc
export interface ShiftConfig {
  code: string; // e.g. HC, CA_SANG, CA_TOI
  name: string; // Ca Hành chính, Ca sáng...
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakStart?: string; // HH:mm
  breakEnd?: string; // HH:mm
  graceLateMinutes: number; // Phút cho phép trễ (ví dụ: 15)
  graceEarlyMinutes: number; // Phút cho phép sớm (ví dụ: 10)
  overtimeAfterMinutes: number; // Phút sau giờ làm tính OT (ví dụ: 30)
  standardWorkHours: number; // 8.0
  isDefault?: boolean;
  applicableDepartments?: string[]; // Phòng ban áp dụng
}

// Module 7: Mẫu bảng công tùy chỉnh
export interface TimesheetColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  width?: number;
}

export interface TimesheetTemplate {
  id: string;
  name: string;
  description: string;
  baseType: 'device_detail' | 'shift_detail' | 'monthly_matrix';
  columns: TimesheetColumnConfig[];
  isDefault?: boolean;
  createdAt: string;
}

// Module 8: Nhật ký hoạt động (Audit Log)
export interface AuditLogItem {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: string;
  target: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details?: string;
  ip?: string;
}

// Lịch sử đồng bộ chi tiết
export interface SyncHistoryItem {
  id: string;
  timestamp: string;
  machineBoxId: string;
  machineName?: string;
  type: 'AUTO_SCHEDULE' | 'MANUAL_TRIGGER' | 'FACE_PUSH';
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  addedRecords: number;
  message: string;
  durationMs: number;
}

