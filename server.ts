import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const p = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(p) && p > 0) return p;
  }
  // In development/preview environment, the dev server must always run on port 3000
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  return Number(process.env.PORT) || 3000;
}
const PORT = getPort();

// Body parsers with large limit for Base64 face images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistent files
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const DATA_FILE = path.join(__dirname, 'data.json');

export interface AutoSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
  syncLogs: boolean;
  syncHeartbeat: boolean;
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'error' | 'idle' | 'running';
  lastSyncMessage?: string;
  lastSyncAdded?: number;
}

interface DeviceProfileItem {
  id: string;
  name: string;
  host: string;
  secret: string;
  appKey: string;
  serial: string;
  lastConnected?: string;
  notes?: string;
}

interface SettingsData {
  host: string;
  appKey: string;
  secret: string;
  serial: string;
  devices: { name: string; box: string; code?: string; lastSeen?: string }[];
  workStart: string;
  autoSync?: AutoSyncConfig;
  savedProfiles?: DeviceProfileItem[];
}

interface DbData {
  emp: Record<string, {
    id: string;
    code?: string;
    name: string;
    department?: string;
    position?: string;
    phone?: string;
    email?: string;
    photo?: string;
    hasPhoto?: boolean;
    registeredFace?: boolean;
    from?: string;
    to?: string;
    machines: string[];
    createdAt?: string;
  }>;
  logs: {
    id: string;
    pid: string;
    name: string;
    time: string;
    m: string;
    temp?: number | null;
    similarity?: number;
  }[];
  seen: Record<string, string>;
  shifts?: {
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    breakStart?: string;
    breakEnd?: string;
    graceLateMinutes: number;
    graceEarlyMinutes: number;
    overtimeAfterMinutes: number;
    standardWorkHours: number;
    isDefault?: boolean;
    applicableDepartments?: string[];
  }[];
  timesheetTemplates?: {
    id: string;
    name: string;
    description: string;
    baseType: 'device_detail' | 'shift_detail' | 'monthly_matrix';
    columns: { key: string; label: string; visible: boolean; order: number; width?: number }[];
    isDefault?: boolean;
    createdAt: string;
  }[];
  auditLogs?: {
    id: string;
    timestamp: string;
    userName: string;
    userRole: string;
    action: string;
    target: string;
    status: 'SUCCESS' | 'WARNING' | 'ERROR';
    details?: string;
    ip?: string;
  }[];
  syncHistory?: {
    id: string;
    timestamp: string;
    machineBoxId: string;
    machineName?: string;
    type: 'AUTO_SCHEDULE' | 'MANUAL_TRIGGER' | 'FACE_PUSH';
    status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
    addedRecords: number;
    message: string;
    durationMs: number;
  }[];
}

// Load settings
let settings: SettingsData = {
  host: process.env.HACHIHI_HOST || '',
  appKey: process.env.APP_KEY || 'k77hcPwEXB4LTdJv96mz',
  secret: process.env.SECRET_KEY || '',
  serial: '',
  devices: [],
  workStart: process.env.WORK_START || '08:30',
  autoSync: {
    enabled: true,
    intervalMinutes: 5,
    syncLogs: true,
    syncHeartbeat: true,
    lastSyncTime: '',
    lastSyncStatus: 'idle',
    lastSyncMessage: 'Sẵn sàng hoạt động',
    lastSyncAdded: 0
  },
  savedProfiles: []
};

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    settings = {
      ...settings,
      ...parsed,
      savedProfiles: parsed.savedProfiles || [],
      autoSync: {
        ...settings.autoSync,
        ...(parsed.autoSync || {})
      }
    };
  }
} catch (e) {
  console.warn('Could not read settings.json:', e);
}

const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving settings.json:', e);
  }
};

const DEFAULT_SHIFTS = [
  {
    code: 'HC',
    name: 'Hành chính (08:00 - 17:00)',
    startTime: '08:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    graceLateMinutes: 15,
    graceEarlyMinutes: 15,
    overtimeAfterMinutes: 30,
    standardWorkHours: 8.0,
    isDefault: true,
    applicableDepartments: []
  },
  {
    code: 'CA1',
    name: 'Ca Sáng (06:00 - 14:00)',
    startTime: '06:00',
    endTime: '14:00',
    breakStart: '10:00',
    breakEnd: '10:30',
    graceLateMinutes: 10,
    graceEarlyMinutes: 10,
    overtimeAfterMinutes: 30,
    standardWorkHours: 8.0,
    isDefault: false,
    applicableDepartments: ['Sản xuất', 'Kho vận']
  },
  {
    code: 'CA2',
    name: 'Ca Chiều (14:00 - 22:00)',
    startTime: '14:00',
    endTime: '22:00',
    breakStart: '18:00',
    breakEnd: '18:30',
    graceLateMinutes: 10,
    graceEarlyMinutes: 10,
    overtimeAfterMinutes: 30,
    standardWorkHours: 8.0,
    isDefault: false,
    applicableDepartments: ['Sản xuất', 'Kỹ thuật']
  }
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-device-detail',
    name: 'Mẫu 1: Chi tiết theo máy (Lần 1...N)',
    description: 'Báo cáo chi tiết theo máy, cứ mỗi lần chấm trong ngày là thêm 1 cột',
    baseType: 'device_detail' as const,
    columns: [
      { key: 'employeeCode', label: 'Mã NV', visible: true, order: 1 },
      { key: 'employeeName', label: 'Tên NV', visible: true, order: 2 },
      { key: 'date', label: 'Ngày', visible: true, order: 3 },
      { key: 'machine', label: 'Máy', visible: true, order: 4 },
      { key: 'punches', label: 'Lần 1, Lần 2, Lần 3...', visible: true, order: 5 }
    ],
    isDefault: true,
    createdAt: '2026-01-01 00:00:00'
  },
  {
    id: 'tpl-shift-detail',
    name: 'Mẫu 2: Chi tiết theo ca (MIN/MAX/Công)',
    description: 'STT, Mã NV, Họ tên, Phòng ban, Ngày, Vào MIN, Ra MAX, Mã Ca, Giờ Vào Chuẩn, Giờ Ra Chuẩn, Phút Trễ, Phút Sớm, Giờ công',
    baseType: 'shift_detail' as const,
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
    ],
    isDefault: true,
    createdAt: '2026-01-01 00:00:00'
  },
  {
    id: 'tpl-monthly-matrix',
    name: 'Mẫu 3: Tổng hợp tháng (Ma trận ngày 1-31)',
    description: 'Bảng công ma trận cả tháng theo từng nhân viên, tổng ngày công và số phút đi muộn',
    baseType: 'monthly_matrix' as const,
    columns: [
      { key: 'code', label: 'Mã NV', visible: true, order: 1 },
      { key: 'name', label: 'Họ tên', visible: true, order: 2 },
      { key: 'department', label: 'Phòng ban', visible: true, order: 3 },
      { key: 'matrix', label: 'Ngày 1 - 31', visible: true, order: 4 },
      { key: 'workDays', label: 'Tổng ngày công', visible: true, order: 5 },
      { key: 'hours', label: 'Tổng giờ', visible: true, order: 6 },
      { key: 'late', label: 'Lượt trễ', visible: true, order: 7 }
    ],
    isDefault: true,
    createdAt: '2026-01-01 00:00:00'
  }
];

// Load database (Real data only, no demo)
let db: DbData = { emp: {}, logs: [], seen: {}, shifts: DEFAULT_SHIFTS, timesheetTemplates: DEFAULT_TEMPLATES, auditLogs: [], syncHistory: [] };
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = {
      ...db,
      ...parsed,
      shifts: parsed.shifts && parsed.shifts.length > 0 ? parsed.shifts : DEFAULT_SHIFTS,
      timesheetTemplates: parsed.timesheetTemplates && parsed.timesheetTemplates.length > 0 ? parsed.timesheetTemplates : DEFAULT_TEMPLATES,
      auditLogs: parsed.auditLogs || [],
      syncHistory: parsed.syncHistory || []
    };
  }
} catch (e) {
  console.warn('Could not read data.json:', e);
}

const saveDb = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving data.json:', e);
  }
};

const logAudit = (userName: string, userRole: string, action: string, target: string, status: 'SUCCESS' | 'WARNING' | 'ERROR', details?: string) => {
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    userName: userName || 'Admin',
    userRole: userRole || 'SUPER_ADMIN',
    action,
    target,
    status,
    details
  });
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDb();
};

const checkServerRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const userRole = (req.headers['x-user-role'] as string) || 'SUPER_ADMIN';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        ok: false,
        error: `Truy cập bị từ chối (403): Vai trò '${userRole}' không được phép thực hiện hành động này.`
      });
    }
    next();
  };
};


const pad2 = (n: number) => String(n).padStart(2, '0');

// Format "yyyy-MM-dd HH:mm:ss" -> "dd/MM/yyyy HH:mm:ss" (Hachihi spec)
const toHachihiTime = (s?: string): string => {
  if (!s) return '';
  const clean = s.replace('T', ' ');
  const [datePart, timePart = '00:00:00'] = clean.split(' ');
  const parts = datePart.split('-');
  if (parts.length < 3) return s;
  const [y, m, d] = parts;
  const timeFormatted = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${pad2(Number(d))}/${pad2(Number(m))}/${y} ${timeFormatted}`;
};

// Format Hachihi "dd/MM/yyyy HH:mm:ss" -> "yyyy-MM-dd HH:mm:ss"
const fromHachihiTime = (s?: string): string => {
  if (!s) return '';
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):?(\d{0,2})/.exec(s);
  if (!m) return s;
  return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))} ${pad2(Number(m[4]))}:${pad2(Number(m[5]))}:${pad2(Number(m[6] || 0))}`;
};

const stripBase64 = (s?: string) => (s || '').replace(/^data:image\/\w+;base64,/, '');

// Extract image from any possible field in Hachihi response
function extractImageFromData(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') {
    const s = data.trim();
    if (s.startsWith('data:image/')) return s;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/')) return s;
    if (s.length > 50 && !s.includes(' ') && !s.includes('<') && (s.startsWith('/9j/') || s.startsWith('iVBORw') || /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 100)))) {
      return `data:image/jpeg;base64,${s}`;
    }
    return undefined;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractImageFromData(item);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof data === 'object') {
    const candidate =
      data.Base64Image ||
      data.base64Image ||
      data.FaceImage ||
      data.faceImage ||
      data.Image ||
      data.image ||
      data.Photo ||
      data.photo ||
      data.Picture ||
      data.picture ||
      data.Avatar ||
      data.avatar ||
      data.Base64 ||
      data.ImgBase64 ||
      data.ImageUrl ||
      data.imageUrl ||
      data.ImgUrl ||
      data.imgUrl ||
      data.FaceUrl ||
      data.faceUrl;

    if (candidate) {
      return extractImageFromData(candidate);
    }
  }
  return undefined;
}

// Real HTTP call to Hachihi API with timeout and robust error parsing
async function callHachihiApi(
  endpoint: string,
  body: Record<string, any> = {},
  customHost?: string,
  customSecret?: string,
  customAppKeyOrTimeout?: string | number,
  timeoutMsInput?: number
) {
  let timeoutMs = 8000;
  let customAppKey: string | undefined;

  if (typeof customAppKeyOrTimeout === 'number') {
    timeoutMs = customAppKeyOrTimeout;
  } else if (typeof customAppKeyOrTimeout === 'string') {
    customAppKey = customAppKeyOrTimeout;
    if (typeof timeoutMsInput === 'number') {
      timeoutMs = timeoutMsInput;
    }
  } else if (typeof timeoutMsInput === 'number') {
    timeoutMs = timeoutMsInput;
  }

  let host = (customHost || settings.host || '').trim().replace(/\/$/, '');
  if (host && !/^https?:\/\//i.test(host)) {
    host = 'https://' + host;
  }
  let secret = (customSecret || '').trim();
  // If secret is masked from UI (e.g. '••••••••') or empty, fallback to stored settings.secret
  if (!secret || secret.includes('•••') || secret.includes('***')) {
    secret = (settings.secret || '').trim();
  }
  const appKey = (customAppKey || settings.appKey || 'k77hcPwEXB4LTdJv96mz').trim();

  if (!host) {
    throw new Error('Chưa cấu hình Website của Hachihi (domain)');
  }
  if (!secret) {
    throw new Error('Chưa cấu hình Api Secret Key của Hachihi');
  }

  const url = `${host}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // CRITICAL: Only AppKey and SecretKey are sent (NO lowercase duplicates).
    // Node.js Headers join duplicate case-insensitive keys with comma: 'abc, abc',
    // which causes Hachihi to reject requests with FARE0011 (401 Unauthorized).
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'AppKey': appKey,
      'SecretKey': secret
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timer);

    const rawText = await response.text();
    let json: any = {};
    try {
      json = JSON.parse(rawText);
    } catch {
      if (typeof rawText === 'string' && rawText.trim()) {
        json = { raw: rawText.trim() };
      }
    }

    if (response.status === 401) {
      const cleanRaw = typeof rawText === 'string' && rawText.trim() ? rawText.trim() : 'Unauthorized access resource';
      return {
        ErrorCode: 'FARE0011',
        ErrorMessage: `Không có quyền truy cập (401 Unauthorized: ${cleanRaw}). Kiểm tra lại Api Secret Key và AppKey tại mục Cài đặt -> Tích hợp API.`,
        httpStatus: 401,
        raw: rawText
      };
    }

    if (response.status === 404) {
      return {
        ErrorCode: '404',
        ErrorMessage: `Endpoint ${endpoint} không tồn tại trên hệ thống Hachihi (404 Not Found)`,
        httpStatus: 404,
        raw: rawText
      };
    }

    if (!response.ok && (!json || typeof json !== 'object' || !json.ErrorCode)) {
      return {
        ErrorCode: `HTTP_${response.status}`,
        ErrorMessage: `Lỗi kết nối Hachihi HTTP ${response.status}: ${rawText.slice(0, 120)}`,
        httpStatus: response.status,
        raw: rawText
      };
    }

    if (typeof json === 'string') {
      json = { ErrorCode: 'RESP_STR', ErrorMessage: json, raw: json };
    }

    // Normalize ErrorCode
    if (json && typeof json === 'object') {
      if (json.ErrorCode === 0 || json.ErrorCode === '0') {
        json.ErrorCode = '000000';
      }
      if (!json.ErrorCode && (json.Result === true || json.Success === true || json.data || json.Data)) {
        json.ErrorCode = '000000';
      }
    }

    return json;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        ErrorCode: 'FARE0013',
        ErrorMessage: `Quá thời gian phản hồi (${timeoutMs / 1000}s) từ máy chủ Hachihi khi gọi ${endpoint}`,
        timeout: true
      };
    }
    throw err;
  }
}

// Log deduplication helper
const addAttendanceLog = (pid: string, time: string, m: string, temp?: number | null) => {
  const cleanPid = String(pid);
  const cleanTime = time.trim();
  const cleanM = String(m);

  const exists = db.logs.some(l => l.pid === cleanPid && l.time === cleanTime && l.m === cleanM);
  if (exists) return 0;

  const empName = db.emp[cleanPid]?.name || `Nhân viên #${cleanPid}`;
  db.logs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    pid: cleanPid,
    name: empName,
    time: cleanTime,
    m: cleanM,
    temp: temp ?? null,
    similarity: 98.5
  });
  return 1;
};

// Generic proxy route for API playground and raw calls
app.post(['/api/hachihi/call', '/api/dahahi/call'], async (req: Request, res: Response) => {
  try {
    const { endpoint, body, host, secret, appKey } = req.body;
    if (!endpoint) {
      return res.status(400).json({ ErrorCode: 'ERR_PARAM', ErrorMessage: 'Thiếu endpoint API' });
    }
    const result = await callHachihiApi(endpoint, body || {}, host, secret, appKey);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ ErrorCode: 'ERR_PROXY', ErrorMessage: e.message });
  }
});

// Auto-Sync Periodic Engine
let autoSyncTimer: NodeJS.Timeout | null = null;
let isSyncRunning = false;

async function executePeriodicSync(): Promise<{ ok: boolean; added: number; message: string }> {
  if (isSyncRunning) {
    return { ok: true, added: 0, message: 'Tiến trình đồng bộ đang chạy' };
  }
  if (!settings.autoSync?.enabled) {
    return { ok: false, added: 0, message: 'Chế độ tự đồng bộ định kỳ đang tắt' };
  }
  if (!settings.host || !settings.secret) {
    if (settings.autoSync) {
      settings.autoSync.lastSyncStatus = 'error';
      settings.autoSync.lastSyncMessage = 'Chưa cấu hình Website Hachihi hoặc Api Secret Key';
    }
    return { ok: false, added: 0, message: 'Chưa cấu hình Website Hachihi hoặc Api Secret Key' };
  }

  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
  isSyncRunning = true;
  if (settings.autoSync) {
    settings.autoSync.lastSyncStatus = 'running';
    settings.autoSync.lastSyncMessage = 'Đang đồng bộ dữ liệu từ thiết bị...';
  }

  let totalAdded = 0;
  const errors: string[] = [];

  try {
    // 1. If syncHeartbeat: verify machine online status
    if (settings.autoSync?.syncHeartbeat) {
      try {
        const pingRes = await callHachihiApi('/api/faceid/getAllMachine', {}, settings.host, settings.secret, 7000);
        if (pingRes && pingRes.ErrorCode === '000000' && Array.isArray(pingRes.Data)) {
          for (const m of pingRes.Data) {
            const boxId = String(m.MachineBoxId);
            const dev = settings.devices.find(d => d.box === boxId);
            if (dev) {
              dev.lastSeen = nowStr;
              dev.name = dev.name || m.MachineName;
              dev.code = m.MachineCode || dev.code;
            }
            db.seen[boxId] = nowStr;
          }
        } else if (pingRes?.ErrorCode === 'FARE0011') {
          errors.push('Lỗi 401: Api Secret Key không hợp lệ');
        }
      } catch (err: any) {
        console.warn('[Auto-Sync] Lỗi ping trạng thái máy:', err.message);
      }
    }

    // 2. If syncLogs: pull checkin records for today and yesterday
    if (settings.autoSync?.syncLogs) {
      const todayDate = new Date();
      const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fromStr = `${yesterdayDate.toISOString().slice(0, 10)} 00:00:00`;
      const toStr = `${todayDate.toISOString().slice(0, 10)} 23:59:59`;

      const targetBoxes = settings.devices.length > 0
        ? settings.devices.map(d => d.box)
        : (settings.serial ? [settings.serial] : []);

      for (const boxId of targetBoxes) {
        try {
          let pageIndex = 1;
          for (;;) {
            const r = await callHachihiApi('/api/facereg/checkinhis', {
              MachineBoxId: boxId,
              FacePersionId: '',
              FromTimeStr: toHachihiTime(fromStr),
              ToTimeStr: toHachihiTime(toStr),
              pageIndex,
              PageSize: 100
            }, settings.host, settings.secret, 8000);

            if (!r || r.ErrorCode !== '000000') {
              if (r?.ErrorCode === 'FARE0011') {
                errors.push(`Máy ${boxId}: 401 Unauthorized (FARE0011)`);
              } else {
                errors.push(`Máy ${boxId}: ${r?.ErrorMessage || r?.ErrorCode || 'Lỗi lấy checkin'}`);
              }
              break;
            }

            const data: any[] = r.Data || [];
            for (const item of data) {
              const rawTime = fromHachihiTime(item.CheckinTimeStr);
              totalAdded += addAttendanceLog(item.FacePersionId, rawTime, boxId, item.Temperature);
            }

            if (!data.length || pageIndex * 100 >= (r.Total || 0)) break;
            pageIndex++;
          }
        } catch (err: any) {
          errors.push(`Máy ${boxId}: ${err.message}`);
        }
      }
    }

    if (totalAdded > 0) {
      saveDb();
    }

    const successMessage = errors.length > 0
      ? `Đồng bộ một phần (+${totalAdded} lượt mới). Cảnh báo: ${errors.join(', ')}`
      : `Tự động đồng bộ thành công lúc ${nowStr.slice(11, 19)} (+${totalAdded} lượt mới)`;

    if (settings.autoSync) {
      settings.autoSync.lastSyncTime = nowStr;
      settings.autoSync.lastSyncAdded = totalAdded;
      settings.autoSync.lastSyncStatus = errors.length > 0 && totalAdded === 0 ? 'error' : 'success';
      settings.autoSync.lastSyncMessage = successMessage;
    }
    saveSettings();

    return {
      ok: errors.length === 0 || totalAdded > 0,
      added: totalAdded,
      message: successMessage
    };
  } catch (globalErr: any) {
    if (settings.autoSync) {
      settings.autoSync.lastSyncTime = nowStr;
      settings.autoSync.lastSyncStatus = 'error';
      settings.autoSync.lastSyncMessage = `Lỗi đồng bộ: ${globalErr.message}`;
    }
    saveSettings();
    return { ok: false, added: 0, message: `Lỗi đồng bộ: ${globalErr.message}` };
  } finally {
    isSyncRunning = false;
  }
}

function startAutoSyncJob() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }

  if (!settings.autoSync?.enabled) {
    return;
  }

  const intervalMinutes = Math.max(1, settings.autoSync.intervalMinutes || 5);
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run initial sync after a short delay if settings are present
  if (settings.host && settings.secret) {
    setTimeout(() => {
      executePeriodicSync().catch(err => console.warn('[Auto-Sync] Lỗi lần chạy đầu:', err.message));
    }, 3500);
  }

  autoSyncTimer = setInterval(() => {
    executePeriodicSync().catch(err => console.warn('[Auto-Sync] Lỗi chu kỳ:', err.message));
  }, intervalMs);
}

// 1. Get connection settings
app.get('/api/settings', (req: Request, res: Response) => {
  res.json({
    host: settings.host,
    appKey: settings.appKey || 'k77hcPwEXB4LTdJv96mz',
    hasSecret: !!settings.secret,
    serial: settings.serial,
    workStart: settings.workStart,
    devices: settings.devices,
    autoSync: settings.autoSync
  });
});

// Auto-sync configuration and manual trigger routes
app.get('/api/sync/auto', (req: Request, res: Response) => {
  res.json({
    ok: true,
    autoSync: settings.autoSync || {
      enabled: false,
      intervalMinutes: 5,
      syncLogs: true,
      syncHeartbeat: true,
      lastSyncStatus: 'idle'
    }
  });
});

app.post('/api/sync/auto', (req: Request, res: Response) => {
  try {
    const { enabled, intervalMinutes, syncLogs, syncHeartbeat } = req.body;
    settings.autoSync = {
      ...settings.autoSync,
      enabled: typeof enabled === 'boolean' ? enabled : settings.autoSync?.enabled ?? true,
      intervalMinutes: typeof intervalMinutes === 'number' && intervalMinutes > 0 ? intervalMinutes : settings.autoSync?.intervalMinutes ?? 5,
      syncLogs: typeof syncLogs === 'boolean' ? syncLogs : settings.autoSync?.syncLogs ?? true,
      syncHeartbeat: typeof syncHeartbeat === 'boolean' ? syncHeartbeat : settings.autoSync?.syncHeartbeat ?? true
    };
    saveSettings();
    startAutoSyncJob();
    return res.json({
      ok: true,
      autoSync: settings.autoSync,
      message: settings.autoSync.enabled
        ? `Đã bật tự động đồng bộ định kỳ (${settings.autoSync.intervalMinutes} phút/lần)`
        : 'Đã tắt tự động đồng bộ định kỳ'
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/sync/trigger', async (req: Request, res: Response) => {
  try {
    const result = await executePeriodicSync();
    return res.json({
      ok: result.ok,
      added: result.added,
      message: result.message,
      autoSync: settings.autoSync
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Connect machine based on Domain, Key, Serial
app.post('/api/connect', async (req: Request, res: Response) => {
  try {
    let host = String(req.body.host || '').trim().replace(/\/$/, '');
    if (host && !/^https?:\/\//i.test(host)) {
      host = 'https://' + host;
    }
    const secret = String(req.body.secret || '').trim() || settings.secret;
    const appKey = String(req.body.appKey || settings.appKey || 'k77hcPwEXB4LTdJv96mz').trim();
    const serial = String(req.body.serial || req.body.box || '').trim();
    const name = String(req.body.name || '').trim();

    if (!host) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Website / Domain của Hachihi' });
    }
    if (!secret) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Api Secret Key' });
    }
    if (!serial) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Serial máy (Mã thiết bị / MachineBoxId)' });
    }

    // Call getAllMachine on real Hachihi server to verify credentials and search for this serial
    const r = await callHachihiApi('/api/faceid/getAllMachine', {}, host, secret, appKey);

    if (!r || r.ErrorCode !== '000000') {
      const errMsg = r?.ErrorMessage || 'Lỗi xác thực với máy chủ Hachihi';
      return res.status(400).json({
        ok: false,
        error: `Không thể kết nối tới ${host}: ${r?.ErrorCode || 'LỖI'} - ${errMsg}. Vui lòng kiểm tra lại Api Secret Key và AppKey.`
      });
    }

    const list: any[] = r.Data || [];
    const matched = list.find(m =>
      String(m.MachineBoxId) === serial ||
      String(m.MachineCode) === serial ||
      String(m.MachineName || '').toLowerCase() === serial.toLowerCase()
    );

    if (!matched) {
      const availableSerials = list.map(x => `${x.MachineName} (Mã: ${x.MachineBoxId})`).join(', ');
      return res.status(404).json({
        ok: false,
        error: `Kết nối tài khoản Hachihi thành công, nhưng không tìm thấy serial "${serial}". Các mã thiết bị hiện có trên tài khoản của bạn: ${availableSerials || '(Chưa có máy nào được gán)'}`
      });
    }

    // Save configuration
    settings.host = host;
    settings.secret = secret;
    settings.appKey = appKey;
    settings.serial = serial;

    const boxId = String(matched.MachineBoxId);
    const existingIndex = settings.devices.findIndex(d => d.box === boxId);
    const deviceItem = {
      name: name || matched.MachineName || `Máy Hachihi ${boxId}`,
      box: boxId,
      code: matched.MachineCode,
      lastSeen: db.seen[boxId] || new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    if (existingIndex >= 0) {
      settings.devices[existingIndex] = deviceItem;
    } else {
      settings.devices.push(deviceItem);
    }

    // Also persist in savedProfiles so user can reuse parameters next time
    if (!settings.savedProfiles) settings.savedProfiles = [];
    const profIndex = settings.savedProfiles.findIndex(p => p.serial === boxId);
    const nowTimeStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const profileItem: DeviceProfileItem = {
      id: profIndex >= 0 ? settings.savedProfiles[profIndex].id : `prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: deviceItem.name,
      host,
      secret,
      appKey,
      serial: boxId,
      lastConnected: nowTimeStr,
      notes: name || matched.MachineName
    };
    if (profIndex >= 0) {
      settings.savedProfiles[profIndex] = profileItem;
    } else {
      settings.savedProfiles.push(profileItem);
    }

    saveSettings();

    return res.json({
      ok: true,
      message: `Kết nối thành công máy ${deviceItem.name} (Serial: ${deviceItem.box})!`,
      device: deviceItem,
      allDevices: settings.devices,
      savedProfile: profileItem
    });
  } catch (err: any) {
    console.error('Error connecting to Hachihi:', err);
    return res.status(500).json({
      ok: false,
      error: `Không thể kết nối tới máy chủ: ${err.message}`
    });
  }
});

// 3. Test connection (Ping)
app.post('/api/test', async (req: Request, res: Response) => {
  try {
    const host = req.body.host ? String(req.body.host).trim().replace(/\/$/, '') : settings.host;
    const secret = req.body.secret ? String(req.body.secret).trim() : settings.secret;
    const appKey = req.body.appKey ? String(req.body.appKey).trim() : (settings.appKey || 'k77hcPwEXB4LTdJv96mz');

    const r = await callHachihiApi('/api/faceid/getAllMachine', {}, host, secret, appKey);
    if (r && r.ErrorCode === '000000') {
      return res.json({
        ok: true,
        machines: (r.Data || []).map((m: any) => ({
          name: m.MachineName,
          code: m.MachineCode,
          box: String(m.MachineBoxId)
        }))
      });
    }
    return res.json({ ok: false, error: `${r?.ErrorCode || 'ERR'}: ${r?.ErrorMessage || 'Lỗi không xác định'}` });
  } catch (e: any) {
    return res.json({ ok: false, error: e.message });
  }
});

// 4. Get connected machines
app.get('/api/machines', (req: Request, res: Response) => {
  const list = settings.devices.map(d => ({
    MachineName: d.name,
    MachineCode: d.code || `MAC${d.box}`,
    MachineBoxId: d.box,
    lastSeen: db.seen[d.box] || d.lastSeen || null,
    isOnline: true
  }));
  res.json(list);
});

// 5. Disconnect machine
app.delete('/api/machines/:boxId', (req: Request, res: Response) => {
  const { boxId } = req.params;
  const prevCount = settings.devices.length;
  settings.devices = settings.devices.filter(d => d.box !== boxId);
  saveSettings();
  res.json({ ok: true, disconnected: prevCount > settings.devices.length, boxId });
});

// 5.1 Device Profiles Management (Lưu lại thông số theo danh sách máy để dùng cho lần sau)
app.get('/api/device-profiles', (req: Request, res: Response) => {
  const profiles = (settings.savedProfiles || []).map(p => ({
    ...p,
    isConnected: settings.devices.some(d => d.box === p.serial)
  }));
  res.json(profiles);
});

app.post('/api/device-profiles', (req: Request, res: Response) => {
  try {
    const { id, name, host, secret, appKey, serial, notes } = req.body;
    if (!host || !serial) {
      return res.status(400).json({ ok: false, error: 'Vui lòng cung cấp tối thiểu Domain và Serial máy' });
    }
    if (!settings.savedProfiles) settings.savedProfiles = [];

    const profileId = id || `prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const index = settings.savedProfiles.findIndex(p => p.id === profileId || p.serial === serial);

    const cleanHost = String(host).trim().replace(/\/$/, '');
    const item: DeviceProfileItem = {
      id: profileId,
      name: (name || `Máy ${serial}`).trim(),
      host: /^https?:\/\//i.test(cleanHost) ? cleanHost : `https://${cleanHost}`,
      secret: (secret || (index >= 0 ? settings.savedProfiles[index].secret : '') || settings.secret || '').trim(),
      appKey: (appKey || 'k77hcPwEXB4LTdJv96mz').trim(),
      serial: String(serial).trim(),
      lastConnected: index >= 0 ? settings.savedProfiles[index].lastConnected : undefined,
      notes: notes || ''
    };

    if (index >= 0) {
      settings.savedProfiles[index] = item;
    } else {
      settings.savedProfiles.push(item);
    }
    saveSettings();

    return res.json({
      ok: true,
      profile: {
        ...item,
        isConnected: settings.devices.some(d => d.box === item.serial)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/device-profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!settings.savedProfiles) settings.savedProfiles = [];
  settings.savedProfiles = settings.savedProfiles.filter(p => p.id !== id && p.serial !== id);
  saveSettings();
  res.json({ ok: true });
});

app.post('/api/device-profiles/:id/connect', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prof = (settings.savedProfiles || []).find(p => p.id === id || p.serial === id);
    if (!prof) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy hồ sơ thông số máy này' });
    }

    const host = prof.host;
    const secret = prof.secret || settings.secret;
    const appKey = prof.appKey || settings.appKey || 'k77hcPwEXB4LTdJv96mz';
    const serial = prof.serial;

    // Verify and connect
    const r = await callHachihiApi('/api/faceid/getAllMachine', {}, host, secret, appKey);
    if (!r || r.ErrorCode !== '000000') {
      return res.status(400).json({
        ok: false,
        error: `Không thể kết nối tới ${host}: ${r?.ErrorMessage || 'Lỗi xác thực key hoặc domain'}`
      });
    }

    const list: any[] = r.Data || [];
    const matched = list.find(m =>
      String(m.MachineBoxId) === serial ||
      String(m.MachineCode) === serial ||
      String(m.MachineName || '').toLowerCase() === serial.toLowerCase()
    );

    const deviceItem = {
      name: prof.name || (matched ? matched.MachineName : `Máy Hachihi ${serial}`),
      box: serial,
      code: matched?.MachineCode || `MAC${serial}`,
      lastSeen: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    const existingIndex = settings.devices.findIndex(d => d.box === serial);
    if (existingIndex >= 0) {
      settings.devices[existingIndex] = deviceItem;
    } else {
      settings.devices.push(deviceItem);
    }

    prof.lastConnected = deviceItem.lastSeen;
    saveSettings();

    return res.json({
      ok: true,
      message: `Đã kết nối thành công máy ${deviceItem.name} (${serial})!`,
      device: deviceItem,
      allDevices: settings.devices
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/device-profiles/:id/disconnect', (req: Request, res: Response) => {
  const { id } = req.params;
  const prof = (settings.savedProfiles || []).find(p => p.id === id || p.serial === id);
  const targetBox = prof ? prof.serial : id;
  settings.devices = settings.devices.filter(d => d.box !== targetBox);
  saveSettings();
  res.json({ ok: true, message: `Đã ngắt kết nối máy ${targetBox}` });
});


// 6. Get employees (Real database)
app.get('/api/employees', (req: Request, res: Response) => {
  const list = Object.values(db.emp).map(e => ({
    ...e,
    hasPhoto: !!e.photo,
    registeredFace: !!e.photo
  })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  res.json(list);
});

// 7. Get raw face photo JPEG buffer
app.get('/api/photo/:id', (req: Request, res: Response) => {
  const emp = db.emp[req.params.id];
  if (!emp || !emp.photo) {
    return res.status(404).send('Not found');
  }
  const clean = stripBase64(emp.photo);
  const buf = Buffer.from(clean, 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache'
  });
  res.end(buf);
});

// 8. Add or Edit Employee, and push to Hachihi machine (/api/facereg/edit)
app.post('/api/employees', async (req: Request, res: Response) => {
  try {
    const b = req.body;
    if (!b.id) {
      return res.status(400).json({ ok: false, error: 'Thiếu mã nhân viên (FacePersonId)' });
    }
    const id = String(b.id).trim();
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ ok: false, error: 'Thiếu họ và tên nhân viên' });
    }

    const current = db.emp[id] || {
      id,
      machines: [],
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    const updated = {
      ...current,
      ...b,
      id,
      name: String(b.name).trim(),
      machines: Array.isArray(b.machines) ? b.machines : current.machines || []
    };

    db.emp[id] = updated;
    saveDb();

    // Push to Hachihi machines if photo is provided and machines are assigned
    const pushResults: Record<string, string> = {};
    if (updated.photo && updated.machines.length > 0) {
      const cleanPhoto = stripBase64(updated.photo);
      for (const mId of updated.machines) {
        try {
          const r = await callHachihiApi('/api/facereg/edit', {
            FacePersionId: updated.id,
            MachineBoxId: mId,
            FullName: updated.name,
            Base64Image: cleanPhoto,
            FromTimeStr: toHachihiTime(updated.from),
            ToTimeStr: toHachihiTime(updated.to)
          });
          pushResults[mId] = r && r.ErrorCode === '000000' ? 'OK' : `${r?.ErrorCode || 'ERR'}: ${r?.ErrorMessage || 'Lỗi đẩy lên máy'}`;
        } catch (e: any) {
          pushResults[mId] = e.message;
        }
      }
    }

    return res.json({
      ok: true,
      employee: updated,
      pushResults,
      warn: !updated.photo ? 'Đã lưu thông tin nhân viên (Chưa có ảnh khuôn mặt nên chưa đẩy lên máy)' : undefined
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 9. Delete employee (removes from machine and database)
app.delete('/api/employees/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const emp = db.emp[id];
    if (!emp) {
      return res.status(404).json({ ok: false, error: 'Nhân viên không tồn tại' });
    }

    const machineResults: Record<string, string> = {};
    for (const mId of emp.machines || []) {
      try {
        const r = await callHachihiApi('/api/facereg/remove', {
          FacePersionId: emp.id,
          MachineBoxId: mId
        });
        machineResults[mId] = r && (r.ErrorCode === '000000' || r.ErrorCode === 'FARE0012')
          ? 'OK'
          : `${r?.ErrorCode || 'ERR'}: ${r?.ErrorMessage || 'Lỗi'}`;
      } catch (e: any) {
        machineResults[mId] = e.message;
      }
    }

    delete db.emp[id];
    saveDb();

    return res.json({ ok: true, machineResults });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 10. Download / Pull all employees and faces from machine (/api/facereg/searchByName + /api/facereg/getInfo)
app.post('/api/pull-machine', async (req: Request, res: Response) => {
  try {
    const host = (req.body.host || settings.host || '').trim().replace(/\/$/, '');
    const secret = (req.body.secret || settings.secret || '').trim();
    const m = String(req.body.machineBoxId || req.body.m || settings.serial || (settings.devices[0]?.box || '')).trim();
    if (!m) {
      return res.status(400).json({ ok: false, error: 'Chưa chọn máy chấm công để lấy dữ liệu' });
    }

    let pageIndex = 1;
    let count = 0;
    let photoCount = 0;

    for (;;) {
      const r = await callHachihiApi('/api/facereg/searchByName', {
        FullName: '',
        MachineBoxId: m,
        pageIndex,
        PageIndex: pageIndex,
        PageSize: 50,
        pageSize: 50,
        getPicture: 1,
        GetPicture: 1,
        isGetPicture: true
      }, host, secret);

      if (!r || (r.ErrorCode !== '000000' && !Array.isArray(r.Data) && !Array.isArray(r.data))) {
        throw new Error(r?.ErrorMessage || `Lỗi khi gọi searchByName (${r?.ErrorCode || 'Lỗi không xác định'})`);
      }

      const list: any[] = r.Data || r.data || [];
      for (const item of list) {
        const id = String(item.FacePersionId || item.FacePersonId || item.EmployeeCode || item.Id || item.id || '');
        if (!id) continue;

        const current = db.emp[id] || {
          id,
          name: item.Name || item.FullName || `Nhân viên #${id}`,
          machines: []
        };
        current.name = item.Name || item.FullName || current.name;
        current.code = item.EmployeeCode || item.Code || current.code || id;
        current.department = item.DepartmentName || item.Department || item.Dept || current.department;
        current.position = item.Position || item.JobTitle || current.position;
        current.phone = item.Phone || item.Mobile || item.Telephone || current.phone;
        current.email = item.Email || current.email;

        if (!current.machines.includes(m)) {
          current.machines.push(m);
        }

        const isFaceRegistered = !!(item.RegisteredFace || item.HasFace || item.hasFace || item.FaceCount > 0);
        if (isFaceRegistered) {
          current.registeredFace = true;
          current.hasPhoto = true;
        }

        // 1. Try to extract photo directly from item response
        let photo = extractImageFromData(item);
        if (photo) {
          if (photo.startsWith('/')) photo = `${host || settings.host}${photo}`;
          current.photo = photo;
          current.hasPhoto = true;
          current.registeredFace = true;
          photoCount++;
        } else {
          // 2. Try /api/facereg/getInfo with both casing styles
          try {
            let info = await callHachihiApi('/api/facereg/getInfo', {
              FacePersionId: id,
              FacePersonId: id,
              PersonId: id,
              EmployeeCode: id,
              MachineBoxId: m,
              getPicture: 1,
              GetPicture: true
            }, host, secret, 4000);

            let extracted = extractImageFromData(info?.Data) || extractImageFromData(info);

            // If not found or timed out, try getInfo on Cloud without MachineBoxId
            if (!extracted) {
              info = await callHachihiApi('/api/facereg/getInfo', {
                FacePersionId: id,
                FacePersonId: id,
                PersonId: id,
                getPicture: 1,
                GetPicture: true
              }, host, secret, 4000);
              extracted = extractImageFromData(info?.Data) || extractImageFromData(info);
            }

            if (extracted) {
              if (extracted.startsWith('/')) extracted = `${host || settings.host}${extracted}`;
              current.photo = extracted;
              current.hasPhoto = true;
              current.registeredFace = true;
              photoCount++;
            } else if (info && (info.ErrorCode === '000000' || isFaceRegistered)) {
              current.hasPhoto = true;
              current.registeredFace = true;
            }
          } catch (e) {
            console.warn(`Could not pull face for ${id}:`, e);
          }
        }

        db.emp[id] = current;
        count++;
      }

      const total = Number(r.Total || r.total || 0);
      if (!list.length || pageIndex * 50 >= total) break;
      pageIndex++;
    }

    saveDb();
    return res.json({
      ok: true,
      count,
      photoCount,
      message: `Đã tải xuống ${count} nhân sự từ máy ${m} (kèm ${photoCount} ảnh khuôn mặt)`
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 11. Download / Pull employees from Hachihi Cloud (v2.0 / Company registry)
app.post('/api/pull-cloud', async (req: Request, res: Response) => {
  try {
    const host = (req.body.host || settings.host || '').trim().replace(/\/$/, '');
    const secret = (req.body.secret || settings.secret || '').trim();
    let count = 0;
    let photoCount = 0;

    // Step 1: Query company-wide registry via /api/facereg/searchByName with MachineBoxId: ''
    let pageIndex = 1;

    for (;;) {
      const r = await callHachihiApi('/api/facereg/searchByName', {
        FullName: '',
        MachineBoxId: '',
        pageIndex,
        PageIndex: pageIndex,
        PageSize: 100,
        pageSize: 100,
        getPicture: 1,
        GetPicture: 1,
        isGetPicture: true
      }, host, secret);

      if (r && (r.ErrorCode === '000000' || Array.isArray(r.Data) || Array.isArray(r.data))) {
        const list: any[] = r.Data || r.data || [];
        for (const item of list) {
          const id = String(item.FacePersionId || item.FacePersonId || item.EmployeeCode || item.Id || item.id || '');
          if (!id) continue;

          const current = db.emp[id] || {
            id,
            name: item.Name || item.FullName || `Nhân viên #${id}`,
            machines: settings.devices.map(d => d.box)
          };

          current.name = item.Name || item.FullName || current.name;
          current.code = item.EmployeeCode || item.Code || current.code || id;
          current.department = item.DepartmentName || item.Department || item.Dept || current.department;
          current.position = item.Position || item.JobTitle || current.position;
          current.phone = item.Phone || item.Mobile || item.Telephone || current.phone;
          current.email = item.Email || current.email;

          if (item.RegisteredFace || item.HasFace || item.hasFace || item.FaceCount > 0) {
            current.registeredFace = true;
            current.hasPhoto = true;
          }

          let photo = extractImageFromData(item);
          if (photo) {
            if (photo.startsWith('/')) photo = `${host || settings.host}${photo}`;
            current.photo = photo;
            current.hasPhoto = true;
            current.registeredFace = true;
            photoCount++;
          }

          db.emp[id] = current;
          count++;
        }

        const total = Number(r.Total || r.total || 0);
        if (!list.length || pageIndex * 100 >= total) break;
        pageIndex++;
      } else {
        break;
      }
    }

    // Step 2: If searchByName returned 0 records, try /api/facereg/GetEmployeeList
    if (count === 0) {
      pageIndex = 1;
      for (;;) {
        const r = await callHachihiApi('/api/facereg/GetEmployeeList', {
          FullName: '',
          PageIndex: pageIndex,
          pageIndex: pageIndex,
          PageSize: 100,
          pageSize: 100,
          getPicture: 1
        }, host, secret);

        if (!r || (r.ErrorCode !== '000000' && !Array.isArray(r.Data) && !Array.isArray(r.data))) {
          if (count === 0) {
            throw new Error(r?.ErrorMessage || `Máy chủ Hachihi phản hồi lỗi: ${r?.ErrorCode || 'Lỗi kết nối'}`);
          }
          break;
        }

        const list: any[] = r.Data || r.data || [];
        for (const item of list) {
          const id = String(item.FacePersionId || item.FacePersonId || item.EmployeeCode || item.Id || item.id || '');
          if (!id) continue;

          const current = db.emp[id] || {
            id,
            name: item.Name || item.FullName || `Nhân viên #${id}`,
            machines: settings.devices.map(d => d.box)
          };

          current.name = item.Name || item.FullName || current.name;
          current.code = item.EmployeeCode || item.Code || current.code || id;
          current.department = item.DepartmentName || item.Department || item.Dept || current.department;
          current.position = item.Position || item.JobTitle || current.position;
          current.phone = item.Phone || item.Mobile || item.Telephone || current.phone;
          current.email = item.Email || current.email;

          if (item.RegisteredFace || item.HasFace || item.hasFace || item.FaceCount > 0) {
            current.registeredFace = true;
            current.hasPhoto = true;
          }

          let photo = extractImageFromData(item);
          if (photo) {
            if (photo.startsWith('/')) photo = `${host || settings.host}${photo}`;
            current.photo = photo;
            current.hasPhoto = true;
            current.registeredFace = true;
            photoCount++;
          }

          db.emp[id] = current;
          count++;
        }

        const total = Number(r.Total || r.total || 0);
        if (!list.length || pageIndex * 100 >= total) break;
        pageIndex++;
      }
    }

    // Step 3: For employees with registeredFace but no raw photo yet, try to pull face concurrently
    const empIdsToFetch = Object.keys(db.emp).filter(id => !db.emp[id].photo && db.emp[id].hasPhoto);
    const batchSize = 4;
    for (let i = 0; i < empIdsToFetch.length; i += batchSize) {
      const batch = empIdsToFetch.slice(i, i + batchSize);
      await Promise.all(batch.map(async (id) => {
        try {
          const emp = db.emp[id];
          const targetBox = emp.machines[0] || settings.serial || (settings.devices[0]?.box || '');
          let info = await callHachihiApi('/api/facereg/getInfo', {
            FacePersionId: id,
            FacePersonId: id,
            PersonId: id,
            MachineBoxId: targetBox,
            getPicture: 1
          }, host, secret, 3500);

          let extracted = extractImageFromData(info?.Data) || extractImageFromData(info);
          if (!extracted) {
            info = await callHachihiApi('/api/facereg/getInfo', {
              FacePersionId: id,
              FacePersonId: id,
              PersonId: id,
              getPicture: 1
            }, host, secret, 3500);
            extracted = extractImageFromData(info?.Data) || extractImageFromData(info);
          }

          if (extracted) {
            if (extracted.startsWith('/')) extracted = `${host || settings.host}${extracted}`;
            emp.photo = extracted;
            emp.hasPhoto = true;
            emp.registeredFace = true;
            photoCount++;
          }
        } catch {}
      }));
    }

    saveDb();
    return res.json({
      ok: true,
      count,
      photoCount,
      message: `Đã tải xuống thành công ${count} nhân sự từ Cloud Hachihi (kèm ${photoCount} ảnh khuôn mặt)`
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 11b. Pull face photo for a specific employee on demand
app.post('/api/employees/:id/pull-face', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const host = (req.body.host || settings.host || '').trim().replace(/\/$/, '');
    const secret = (req.body.secret || settings.secret || '').trim();
    const targetBox = String(req.body.m || req.body.machineBoxId || settings.serial || (settings.devices[0]?.box || '')).trim();

    // 1. Try getInfo with MachineBoxId
    let info = await callHachihiApi('/api/facereg/getInfo', {
      FacePersionId: id,
      FacePersonId: id,
      PersonId: id,
      MachineBoxId: targetBox,
      getPicture: 1,
      GetPicture: true
    }, host, secret, 5000);

    let photo = extractImageFromData(info?.Data) || extractImageFromData(info);

    // 2. Try getInfo without MachineBoxId (Cloud registry)
    if (!photo) {
      info = await callHachihiApi('/api/facereg/getInfo', {
        FacePersionId: id,
        FacePersonId: id,
        PersonId: id,
        getPicture: 1,
        GetPicture: true
      }, host, secret, 5000);
      photo = extractImageFromData(info?.Data) || extractImageFromData(info);
    }

    // 3. Try searchByName with this employee's name/ID
    if (!photo) {
      const searchRes = await callHachihiApi('/api/facereg/searchByName', {
        FullName: db.emp[id]?.name || '',
        MachineBoxId: targetBox,
        pageIndex: 1,
        PageSize: 10,
        getPicture: 1,
        GetPicture: true
      }, host, secret, 5000);

      const list: any[] = searchRes?.Data || searchRes?.data || [];
      const match = list.find(item => String(item.FacePersionId || item.FacePersonId || item.EmployeeCode || item.Id) === id);
      if (match) {
        photo = extractImageFromData(match);
      }
    }

    if (photo) {
      if (photo.startsWith('/')) photo = `${host || settings.host}${photo}`;
      if (db.emp[id]) {
        db.emp[id].photo = photo;
        db.emp[id].hasPhoto = true;
        db.emp[id].registeredFace = true;
        saveDb();
      }
      return res.json({ ok: true, photo, message: 'Đã tải thành công ảnh Face ID' });
    }

    return res.status(404).json({
      ok: false,
      error: info?.ErrorMessage || 'Không tìm thấy dữ liệu ảnh Face ID trên máy hoặc Cloud',
      errorCode: info?.ErrorCode,
      raw: info
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 12. Download / Sync checkin logs from machine (/api/facereg/checkinhis)
app.post('/api/sync-logs', async (req: Request, res: Response) => {
  try {
    const { from, to, m } = req.body;
    const targetMachines = m ? [m] : settings.devices.map(d => d.box);

    if (targetMachines.length === 0) {
      return res.status(400).json({ ok: false, error: 'Chưa có máy chấm công nào được kết nối' });
    }

    let addedCount = 0;
    const fromStr = from ? `${from} 00:00:00` : `${new Date().toISOString().slice(0, 10)} 00:00:00`;
    const toStr = to ? `${to} 23:59:59` : `${new Date().toISOString().slice(0, 10)} 23:59:59`;

    for (const boxId of targetMachines) {
      let pageIndex = 1;
      for (;;) {
        const r = await callHachihiApi('/api/facereg/checkinhis', {
          MachineBoxId: boxId,
          FacePersionId: '',
          FromTimeStr: toHachihiTime(fromStr),
          ToTimeStr: toHachihiTime(toStr),
          pageIndex,
          PageSize: 200
        });

        if (!r || r.ErrorCode !== '000000') {
          throw new Error(r?.ErrorMessage || 'Lỗi khi gọi checkinhis');
        }

        const data: any[] = r.Data || [];
        for (const item of data) {
          const rawTime = fromHachihiTime(item.CheckinTimeStr);
          addedCount += addAttendanceLog(item.FacePersionId, rawTime, boxId, item.Temperature);
        }

        if (!data.length || pageIndex * 200 >= (r.Total || 0)) break;
        pageIndex++;
      }
    }

    saveDb();
    return res.json({
      ok: true,
      added: addedCount,
      message: `Đã đồng bộ thành công ${addedCount} bản ghi chấm công từ máy`
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 13. Get Attendance Logs with filters
app.get('/api/logs', (req: Request, res: Response) => {
  const { from, to, m, pid } = req.query;
  const filtered = db.logs.filter(l => {
    const logDate = l.time.slice(0, 10);
    if (from && logDate < String(from)) return false;
    if (to && logDate > String(to)) return false;
    if (m && l.m !== String(m)) return false;
    if (pid && !l.pid.includes(String(pid)) && !l.name.toLowerCase().includes(String(pid).toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.time.localeCompare(a.time));

  res.json(filtered.slice(0, 3000));
});

// 14. Sync Faces between machines (/api/facereg/SyncFace)
app.post('/api/sync-faces', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'Thiếu máy nguồn hoặc máy đích' });
    }
    const r = await callHachihiApi('/api/facereg/SyncFace', {
      FromMachineBoxId: from,
      ToMachineBoxId: to
    });
    if (r && r.ErrorCode === '000000') {
      return res.json({ ok: true, data: r });
    }
    return res.status(400).json({ ok: false, error: r?.ErrorMessage || 'Lỗi khi gửi lệnh SyncFace' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 15. Clear all persons on machine (/api/facereg/ClearAllPerson)
app.post('/api/clear-machine', checkServerRole(['SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const { machineBoxId } = req.body;
    if (!machineBoxId) {
      return res.status(400).json({ ok: false, error: 'Thiếu mã thiết bị' });
    }
    const r = await callHachihiApi('/api/facereg/ClearAllPerson', {
      MachineBoxId: machineBoxId
    });
    if (r && r.ErrorCode === '000000') {
      for (const e of Object.values(db.emp)) {
        e.machines = (e.machines || []).filter(x => x !== machineBoxId);
      }
      saveDb();
      logAudit(
        (req.headers['x-user-name'] as string) || 'Admin',
        (req.headers['x-user-role'] as string) || 'SUPER_ADMIN',
        'CLEAR_MACHINE',
        `Thiết bị ${machineBoxId}`,
        'WARNING',
        'Xóa toàn bộ người dùng trên thiết bị'
      );
      return res.json({ ok: true, message: 'Đã xóa toàn bộ khuôn mặt trên máy. Thiết bị đang khởi động lại.' });
    }
    return res.status(400).json({ ok: false, error: r?.ErrorMessage || 'Lỗi khi xóa người dùng' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================== MODULE 6: CẤU HÌNH TÍNH CÔNG & CA LÀM VIỆC ====================
app.get('/api/shifts', (req: Request, res: Response) => {
  res.json(db.shifts || DEFAULT_SHIFTS);
});

app.post('/api/shifts', checkServerRole(['SUPER_ADMIN', 'HR_MANAGER']), (req: Request, res: Response) => {
  try {
    const shift = req.body;
    if (!shift.code || !shift.name || !shift.startTime || !shift.endTime) {
      return res.status(400).json({ ok: false, error: 'Thiếu thông tin bắt buộc của ca làm việc (Mã, Tên, Giờ bắt đầu, Giờ kết thúc)' });
    }
    if (!db.shifts) db.shifts = [...DEFAULT_SHIFTS];
    const idx = db.shifts.findIndex(s => s.code.toLowerCase() === shift.code.toLowerCase());
    if (idx >= 0) {
      db.shifts[idx] = { ...db.shifts[idx], ...shift };
    } else {
      db.shifts.push(shift);
    }
    saveDb();
    logAudit(
      (req.headers['x-user-name'] as string) || 'Admin',
      (req.headers['x-user-role'] as string) || 'HR_MANAGER',
      idx >= 0 ? 'UPDATE_SHIFT' : 'CREATE_SHIFT',
      `Ca ${shift.code} (${shift.name})`,
      'SUCCESS',
      `Giờ làm: ${shift.startTime} - ${shift.endTime}`
    );
    res.json({ ok: true, shifts: db.shifts });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/shifts/:code', checkServerRole(['SUPER_ADMIN', 'HR_MANAGER']), (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    if (!db.shifts) db.shifts = [...DEFAULT_SHIFTS];
    const prevLen = db.shifts.length;
    db.shifts = db.shifts.filter(s => s.code.toLowerCase() !== code.toLowerCase());
    if (db.shifts.length === prevLen) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy ca làm việc' });
    }
    saveDb();
    logAudit(
      (req.headers['x-user-name'] as string) || 'Admin',
      (req.headers['x-user-role'] as string) || 'HR_MANAGER',
      'DELETE_SHIFT',
      `Ca ${code}`,
      'SUCCESS'
    );
    res.json({ ok: true, shifts: db.shifts });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== MODULE 7: MẪU BẢNG CÔNG ====================
app.get('/api/timesheet-templates', (req: Request, res: Response) => {
  res.json(db.timesheetTemplates || DEFAULT_TEMPLATES);
});

app.post('/api/timesheet-templates', checkServerRole(['SUPER_ADMIN', 'HR_MANAGER']), (req: Request, res: Response) => {
  try {
    const tpl = req.body;
    if (!tpl.name) {
      return res.status(400).json({ ok: false, error: 'Thiếu tên mẫu bảng công' });
    }
    if (!db.timesheetTemplates) db.timesheetTemplates = [...DEFAULT_TEMPLATES];
    const id = tpl.id || `tpl-${Date.now()}`;
    const idx = db.timesheetTemplates.findIndex(t => t.id === id);
    const item = {
      ...tpl,
      id,
      createdAt: tpl.createdAt || new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    if (idx >= 0) {
      db.timesheetTemplates[idx] = item;
    } else {
      db.timesheetTemplates.push(item);
    }
    saveDb();
    logAudit(
      (req.headers['x-user-name'] as string) || 'Admin',
      (req.headers['x-user-role'] as string) || 'HR_MANAGER',
      idx >= 0 ? 'UPDATE_TEMPLATE' : 'CREATE_TEMPLATE',
      `Mẫu bảng công: ${tpl.name}`,
      'SUCCESS'
    );
    res.json({ ok: true, templates: db.timesheetTemplates });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/timesheet-templates/:id', checkServerRole(['SUPER_ADMIN', 'HR_MANAGER']), (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!db.timesheetTemplates) db.timesheetTemplates = [...DEFAULT_TEMPLATES];
    db.timesheetTemplates = db.timesheetTemplates.filter(t => t.id !== id);
    saveDb();
    res.json({ ok: true, templates: db.timesheetTemplates });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== MODULE 4: CHỐNG TRÙNG LẶP & ĐỐI CHIẾU DỮ LIỆU ====================
app.post('/api/attendance/deduplicate', checkServerRole(['SUPER_ADMIN', 'HR_MANAGER', 'TECHNICIAN']), (req: Request, res: Response) => {
  try {
    const beforeCount = db.logs.length;
    const seenMap = new Set<string>();
    const uniqueLogs: typeof db.logs = [];

    // Deduplicate by PID + Date (YYYY-MM-DD) + Hour:Minute + Machine
    for (const log of db.logs) {
      const minuteKey = `${log.pid}_${log.time.slice(0, 16)}_${log.m}`;
      if (!seenMap.has(minuteKey)) {
        seenMap.add(minuteKey);
        uniqueLogs.push(log);
      }
    }

    const removedCount = beforeCount - uniqueLogs.length;
    db.logs = uniqueLogs;
    saveDb();

    logAudit(
      (req.headers['x-user-name'] as string) || 'Admin',
      (req.headers['x-user-role'] as string) || 'SUPER_ADMIN',
      'DEDUPLICATE_LOGS',
      'Nhật ký chấm công',
      'SUCCESS',
      `Đã lọc bỏ ${removedCount} bản ghi trùng lặp`
    );

    res.json({
      ok: true,
      removedCount,
      totalRemaining: db.logs.length,
      message: `Đã loại bỏ thành công ${removedCount} bản ghi chấm công trùng lặp.`
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== MODULE 8: AUDIT LOGS & BACKUP/RESTORE ====================
app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json(db.auditLogs || []);
});

app.post('/api/audit-logs', (req: Request, res: Response) => {
  const { action, target, details, status } = req.body;
  logAudit(
    (req.headers['x-user-name'] as string) || req.body.userName || 'Người dùng',
    (req.headers['x-user-role'] as string) || req.body.userRole || 'VIEWER',
    action || 'USER_ACTION',
    target || 'Hệ thống',
    status || 'SUCCESS',
    details
  );
  res.json({ ok: true });
});

app.get('/api/sync-history', (req: Request, res: Response) => {
  res.json(db.syncHistory || []);
});

app.get('/api/system/backup', checkServerRole(['SUPER_ADMIN']), (req: Request, res: Response) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    version: '3.0.0',
    settings,
    db
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="hachihi_backup_${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(backup, null, 2));
});

app.post('/api/system/restore', checkServerRole(['SUPER_ADMIN']), (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || !payload.db || !payload.settings) {
      return res.status(400).json({ ok: false, error: 'File sao lưu không hợp lệ. Phải bao gồm các trường db và settings.' });
    }
    db = payload.db;
    settings = payload.settings;
    saveDb();
    saveSettings();
    logAudit(
      (req.headers['x-user-name'] as string) || 'Admin',
      (req.headers['x-user-role'] as string) || 'SUPER_ADMIN',
      'SYSTEM_RESTORE',
      'Toàn bộ cơ sở dữ liệu',
      'WARNING',
      `Khôi phục từ bản sao lưu ngày ${payload.exportedAt || 'Không rõ'}`
    );
    res.json({ ok: true, message: 'Khôi phục hệ thống thành công!' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


// 16. Webhook: Real-time Checkin Callback from Hachihi Device
app.post('/callback/checkin', (req: Request, res: Response) => {
  const b = req.body;
  if (b.FacePersonId) {
    const rawTime = fromHachihiTime(b.CheckinTime) || new Date().toISOString().replace('T', ' ').slice(0, 19);
    addAttendanceLog(b.FacePersonId, rawTime, b.MachineBoxId, b.Temperature);
    saveDb();
  }
  return res.json({ ErrorCode: '000000', ErrorMessage: 'Thành công' });
});

// 17. Webhook: Real-time Heartbeat Callback from Hachihi Device
app.post('/callback/heartbeat', (req: Request, res: Response) => {
  const b = req.body;
  if (b.MachineBoxId) {
    const rawTime = fromHachihiTime(b.MachineTime) || new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.seen[b.MachineBoxId] = rawTime;
    const device = settings.devices.find(d => d.box === String(b.MachineBoxId));
    if (device) {
      device.lastSeen = rawTime;
    }
    saveSettings();
    saveDb();
  }
  return res.json({ ErrorCode: '000000', ErrorMessage: 'Thành công' });
});

// ==================== VITE MIDDLEWARE / STATIC SERVING ====================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hachihi Attendance Full-Stack Server running at http://localhost:${PORT}`);
    startAutoSyncJob();
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
