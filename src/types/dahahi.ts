export type RoleType = 'SUPER_ADMIN' | 'HR_MANAGER' | 'TECHNICIAN' | 'VIEWER' | 'CUSTOM';

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
