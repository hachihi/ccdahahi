import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';


const app = express();

// Body parsers with large limit for Base64 face images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistent files
// Trên Vercel chỉ ghi được vào /tmp (không bền, xem ghi chú nâng cấp CSDL)
const DATA_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

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

interface SettingsData {
  host: string;
  appKey: string;
  secret: string;
  serial: string;
  devices: { name: string; box: string; code?: string; lastSeen?: string }[];
  workStart: string;
  autoSync?: AutoSyncConfig;
}

export type SyncStatus = 'pending' | 'ok' | 'failed';

/** Trạng thái đồng bộ của một nhân viên trên MỘT máy chấm công */
export interface MachineSync {
  status: SyncStatus;
  action: 'push' | 'remove';
  error?: string;
  at: string;
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
    sync?: Record<string, MachineSync>;
    pendingDelete?: boolean;
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
}

// Load settings
let settings: SettingsData = {
  host: process.env.HACHIHI_HOST || '',
  appKey: process.env.APP_KEY || 'k77hcPwEXB4LTdJv96mz',
  secret: process.env.SECRET_KEY || '',
  serial: process.env.HACHIHI_SERIAL || '',
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
  }
};

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    settings = {
      ...settings,
      ...parsed,
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

// Load database (Real data only, no demo)
let db: DbData = { emp: {}, logs: [], seen: {} };
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    db = { ...db, ...JSON.parse(raw) };
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

// ---------- Giờ Việt Nam (máy chấm công lưu giờ địa phương, KHÔNG dùng UTC) ----------
const VN_TZ = 'Asia/Ho_Chi_Minh';
/** "YYYY-MM-DD HH:mm:ss" theo giờ Việt Nam */
const nowVN = (): string => new Intl.DateTimeFormat('sv-SE', {
  timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(new Date());
/** "YYYY-MM-DD" hôm nay theo giờ Việt Nam */
const todayVN = (): string => nowVN().slice(0, 10);
const addDaysStr = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
};
/** Chia khoảng ngày thành các đoạn nhỏ để mỗi lần gọi máy không quá nặng */
const splitRange = (from: string, to: string, days = 7): { from: string; to: string }[] => {
  const out: { from: string; to: string }[] = [];
  let cur = from;
  while (cur <= to) {
    const end = addDaysStr(cur, days - 1);
    out.push({ from: cur, to: end < to ? end : to });
    cur = addDaysStr(cur, days);
  }
  return out;
};
const VALID_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

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
async function callHachihiApiOnce(
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

/**
 * Gọi API Hachihi có thử lại có giới hạn (tối đa 2 lần thử lại, chờ 0,5s rồi 1,5s) CHỈ khi lỗi tạm thời:
 * quá thời gian, lỗi mạng, hoặc HTTP 5xx. Không thử lại với lỗi cấu hình/401/404 hoặc khi máy trả lỗi nghiệp vụ.
 * Không thử lại: ClearAllPerson (thao tác nguy hiểm) và các lệnh gọi đặt timeout ngắn (<7s) có chủ đích.
 */
const RETRY_DELAYS_MS = [500, 1500];
async function callHachihiApi(
  endpoint: string,
  body: Record<string, any> = {},
  customHost?: string,
  customSecret?: string,
  customAppKeyOrTimeout?: string | number,
  timeoutMsInput?: number
) {
  const shortTimeout = typeof customAppKeyOrTimeout === 'number' && customAppKeyOrTimeout < 7000;
  const retryable = !shortTimeout && !/ClearAllPerson/i.test(endpoint);
  const maxRetries = retryable ? RETRY_DELAYS_MS.length : 0;

  for (let attempt = 0; ; attempt++) {
    try {
      const r: any = await callHachihiApiOnce(endpoint, body, customHost, customSecret, customAppKeyOrTimeout, timeoutMsInput);
      const transient = r && (r.timeout === true || (typeof r.httpStatus === 'number' && r.httpStatus >= 500));
      if (transient && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      if (transient && attempt > 0 && r && typeof r === 'object') r.attempts = attempt + 1;
      return r;
    } catch (err: any) {
      // Lỗi cấu hình (thiếu host/secret) là Error thường -> không thử lại; lỗi mạng của fetch là TypeError
      const network = err?.name === 'TypeError' || /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(String(err?.message));
      if (network && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw err;
    }
  }
}

// Log deduplication helper
// Chỉ mục chống trùng O(1): khóa = mã NV | thời điểm | máy
let logIndex: Set<string> | null = null;
const logKey = (pid: string, time: string, m: string) => `${pid}|${time}|${m}`;

const addAttendanceLog = (
  pid: string,
  time: string,
  m: string,
  temp?: number | null,
  similarity?: number
) => {
  const cleanPid = String(pid ?? '').trim();
  const cleanM = String(m ?? '');
  // Chuẩn hóa "2026-10-29T08:00:00" -> "2026-10-29 08:00:00" và bỏ qua giờ không hợp lệ
  const cleanTime = String(time || '').trim().replace('T', ' ').slice(0, 19);
  if (!cleanPid || !VALID_TIME.test(cleanTime)) return 0;

  if (!logIndex) {
    logIndex = new Set(db.logs.map(l => logKey(l.pid, l.time, l.m)));
  }
  const key = logKey(cleanPid, cleanTime, cleanM);
  if (logIndex.has(key)) return 0;
  logIndex.add(key);

  const empName = db.emp[cleanPid]?.name || `Nhân viên #${cleanPid}`;
  db.logs.push({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    pid: cleanPid,
    name: empName,
    time: cleanTime,
    m: cleanM,
    temp: temp ?? null,
    // Chỉ lưu khi máy thực sự trả về, không gán số giả
    similarity: Number.isFinite(similarity) ? similarity : undefined
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

  const nowStr = nowVN();
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
                  const fromStr = `${addDaysStr(todayVN(), -1)} 00:00:00`;
      const toStr = `${todayVN()} 23:59:59`;

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
              totalAdded += addAttendanceLog(item.FacePersionId, rawTime, boxId, item.Temperature, Number(item.Similarity ?? item.similarity));
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
      lastSeen: db.seen[boxId] || nowVN()
    };

    if (existingIndex >= 0) {
      settings.devices[existingIndex] = deviceItem;
    } else {
      settings.devices.push(deviceItem);
    }
    saveSettings();

    return res.json({
      ok: true,
      message: `Kết nối thành công máy ${deviceItem.name} (Serial: ${deviceItem.box})!`,
      device: deviceItem,
      allDevices: settings.devices
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
  settings.devices = settings.devices.filter(d => d.box !== boxId);
  saveSettings();
  res.json({ ok: true });
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

// ==================== ĐỒNG BỘ NHÂN VIÊN LÊN MÁY (trạng thái theo từng máy) ====================
//
// Nguyên tắc: dữ liệu cục bộ chỉ được coi là "đã đồng bộ" khi máy xác nhận.
// Mỗi nhân viên có `sync[machineId]` = { status: pending | ok | failed, action: push | remove, error, at }
// và cờ `pendingDelete` khi đã yêu cầu xóa nhưng chưa xóa được trên mọi máy.

type EmpRecord = DbData['emp'][string];
interface Ctx { host?: string; secret?: string }

const nowStamp = () => nowVN();
const ctxOf = (req: Request): Ctx => ({ host: req.body?.host, secret: req.body?.secret });

/** Đẩy (thêm/sửa) một nhân viên lên MỘT máy */
async function pushOne(emp: EmpRecord, mId: string, ctx: Ctx): Promise<MachineSync> {
  const at = nowStamp();
  if (!emp.photo) {
    return { status: 'pending', action: 'push', error: 'Chưa có ảnh khuôn mặt nên chưa đẩy lên máy', at };
  }
  try {
    const r = await callHachihiApi('/api/facereg/edit', {
      FacePersionId: emp.id,
      MachineBoxId: mId,
      FullName: emp.name,
      Base64Image: stripBase64(emp.photo),
      FromTimeStr: toHachihiTime(emp.from),
      ToTimeStr: toHachihiTime(emp.to)
    }, ctx.host, ctx.secret);
    if (r && r.ErrorCode === '000000') return { status: 'ok', action: 'push', at };
    return {
      status: 'failed',
      action: 'push',
      error: `${r?.ErrorCode || 'ERR'}: ${r?.ErrorMessage || 'Lỗi đẩy lên máy'}`,
      at
    };
  } catch (e: any) {
    return { status: 'failed', action: 'push', error: e.message, at };
  }
}

/** Xóa một nhân viên khỏi MỘT máy. Máy báo "không tồn tại" (FARE0012) cũng coi là đã xóa. */
async function removeOne(empId: string, mId: string, ctx: Ctx): Promise<MachineSync> {
  const at = nowStamp();
  try {
    const r = await callHachihiApi('/api/facereg/remove', {
      FacePersionId: empId,
      MachineBoxId: mId
    }, ctx.host, ctx.secret);
    if (r && (r.ErrorCode === '000000' || r.ErrorCode === 'FARE0012')) {
      return { status: 'ok', action: 'remove', at };
    }
    return {
      status: 'failed',
      action: 'remove',
      error: `${r?.ErrorCode || 'ERR'}: ${r?.ErrorMessage || 'Lỗi xóa trên máy'}`,
      at
    };
  } catch (e: any) {
    return { status: 'failed', action: 'remove', error: e.message, at };
  }
}

const toResultMap = (sync: Record<string, MachineSync>, machines: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of machines) {
    const s = sync[m];
    if (s) out[m] = s.status === 'ok' ? 'OK' : (s.error || 'Chưa đồng bộ');
  }
  return out;
};

const needsAttention = (e: EmpRecord): boolean =>
  !!e.pendingDelete || Object.values(e.sync || {}).some(s => s.status !== 'ok');

/** Xóa nhân viên trên mọi máy được gán. Trả về true nếu TẤT CẢ máy đã xác nhận. */
async function removeFromAllMachines(emp: EmpRecord, ctx: Ctx): Promise<boolean> {
  emp.sync = emp.sync || {};
  const targets = new Set<string>([
    ...(emp.machines || []),
    ...Object.entries(emp.sync).filter(([, s]) => s.action === 'remove').map(([m]) => m)
  ]);
  let allOk = true;
  for (const mId of targets) {
    const r = await removeOne(emp.id, mId, ctx);
    emp.sync[mId] = r;
    if (r.status !== 'ok') allOk = false;
  }
  return allOk;
}

/** Thử lại các mục chưa đồng bộ của một nhân viên. Trả về true nếu bản ghi đã bị xóa hoàn toàn. */
async function retryEmployee(emp: EmpRecord, ctx: Ctx): Promise<boolean> {
  emp.sync = emp.sync || {};

  if (emp.pendingDelete) {
    const ok = await removeFromAllMachines(emp, ctx);
    if (ok) {
      delete db.emp[emp.id];
      return true;
    }
    return false;
  }

  // 1) các lệnh xóa còn dang dở (máy đã bị bỏ khỏi danh sách gán)
  for (const [mId, s] of Object.entries(emp.sync)) {
    if (s.action === 'remove' && s.status !== 'ok') {
      const r = await removeOne(emp.id, mId, ctx);
      if (r.status === 'ok') delete emp.sync[mId];
      else emp.sync[mId] = r;
    }
  }
  // 2) các lần đẩy chưa thành công
  for (const mId of emp.machines || []) {
    const s = emp.sync[mId];
    if (s && s.status !== 'ok' && s.action === 'push' && emp.photo) {
      emp.sync[mId] = await pushOne(emp, mId, ctx);
    }
  }
  return false;
}

// 8. Add or Edit Employee: lưu cục bộ rồi đẩy lên từng máy, ghi trạng thái từng máy
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
    const ctx = ctxOf(req);

    const current = db.emp[id] || {
      id,
      machines: [],
      createdAt: nowVN()
    };
    const prevMachines: string[] = current.machines || [];

    // Không cho client ghi đè các trường trạng thái do máy chủ quản lý
    const { host: _h, secret: _s, sync: _sy, pendingDelete: _pd, ...fields } = b;
    const updated: EmpRecord = {
      ...current,
      ...fields,
      id,
      name: String(b.name).trim(),
      machines: Array.isArray(b.machines) ? b.machines : current.machines || []
    };
    delete updated.pendingDelete; // lưu lại nghĩa là người dùng muốn giữ nhân viên này
    updated.sync = { ...(current.sync || {}) };

    db.emp[id] = updated;
    saveDb();

    // Máy bị bỏ khỏi danh sách gán -> xóa nhân viên khỏi máy đó
    for (const mId of prevMachines.filter(m => !updated.machines.includes(m))) {
      const r = await removeOne(id, mId, ctx);
      if (r.status === 'ok') delete updated.sync![mId];
      else updated.sync![mId] = r;
    }
    // Các máy đang gán -> đẩy lên
    for (const mId of updated.machines) {
      updated.sync![mId] = await pushOne(updated, mId, ctx);
    }
    saveDb();

    const pushResults = updated.photo ? toResultMap(updated.sync!, updated.machines) : {};
    const failed = updated.machines.filter(m => updated.sync![m]?.status === 'failed');
    return res.json({
      ok: true,
      employee: updated,
      pushResults,
      failedMachines: failed,
      warn: !updated.photo
        ? 'Đã lưu thông tin nhân viên (Chưa có ảnh khuôn mặt nên chưa đẩy lên máy)'
        : failed.length > 0
          ? `Đã lưu trên hệ thống nhưng đẩy lên máy thất bại ở ${failed.length} máy. Có thể bấm "Đẩy lại" để thử lại.`
          : undefined
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 9. Delete employee: chỉ xóa cục bộ khi MỌI máy đã xác nhận (hoặc người dùng chọn xóa cưỡng bức)
app.delete('/api/employees/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const emp = db.emp[id];
    if (!emp) {
      return res.status(404).json({ ok: false, error: 'Nhân viên không tồn tại' });
    }
    const force = req.query.force === 'true' || req.body?.force === true;

    const allOk = await removeFromAllMachines(emp, ctxOf(req));
    const machineResults = toResultMap(emp.sync || {}, Object.keys(emp.sync || {}));

    if (allOk || force) {
      delete db.emp[id];
      saveDb();
      return res.json({ ok: true, deleted: true, forced: force && !allOk, machineResults });
    }

    emp.pendingDelete = true; // giữ bản ghi để còn biết máy nào chưa xóa được
    saveDb();
    return res.json({
      ok: true,
      deleted: false,
      pending: true,
      machineResults,
      warn: 'Chưa xóa được nhân viên trên một số máy nên hệ thống giữ lại ở trạng thái "Chờ xóa". Hãy kiểm tra kết nối máy rồi bấm "Đẩy lại".'
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 9b. Thử lại các mục chưa đồng bộ của một nhân viên
app.post('/api/employees/:id/retry', async (req: Request, res: Response) => {
  try {
    const emp = db.emp[String(req.params.id)];
    if (!emp) {
      return res.status(404).json({ ok: false, error: 'Nhân viên không tồn tại' });
    }
    const deleted = await retryEmployee(emp, ctxOf(req));
    saveDb();
    return res.json({
      ok: true,
      deleted,
      employee: deleted ? undefined : emp,
      stillFailing: !deleted && needsAttention(emp)
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 9c. Thử lại hàng loạt (theo lô nhỏ để không vượt giới hạn thời gian của serverless)
app.post('/api/employees/retry-failed', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 15));
    const ctx = ctxOf(req);
    const queue = Object.values(db.emp).filter(needsAttention);
    let processed = 0;
    let fixed = 0;
    let removed = 0;
    for (const emp of queue.slice(0, limit)) {
      const deleted = await retryEmployee(emp, ctx);
      processed++;
      if (deleted) removed++;
      else if (!needsAttention(emp)) fixed++;
    }
    saveDb();
    const remaining = Object.values(db.emp).filter(needsAttention).length;
    return res.json({ ok: true, processed, fixed, removed, remaining });
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
    const targetMachines: string[] = m ? [m] : settings.devices.map(d => d.box);

    if (targetMachines.length === 0) {
      return res.status(400).json({ ok: false, error: 'Chưa có máy chấm công nào được kết nối' });
    }

    const fromDate = from || todayVN();
    const toDate = to || todayVN();
    if (fromDate > toDate) {
      return res.status(400).json({ ok: false, error: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc' });
    }
    const chunks = splitRange(fromDate, toDate, 7);

    interface MachineResult { machine: string; added: number; error?: string; failedChunks: string[] }
    const results: MachineResult[] = [];

    // Mỗi máy xử lý độc lập: một máy lỗi không làm hỏng các máy còn lại,
    // và mỗi đoạn 7 ngày lỗi chỉ ảnh hưởng đoạn đó (được liệt kê để người dùng tải lại).
    for (const boxId of targetMachines) {
      const r: MachineResult = { machine: boxId, added: 0, failedChunks: [] };
      for (const c of chunks) {
        try {
          let pageIndex = 1;
          for (;;) {
            const resp = await callHachihiApi('/api/facereg/checkinhis', {
              MachineBoxId: boxId,
              FacePersionId: '',
              FromTimeStr: toHachihiTime(`${c.from} 00:00:00`),
              ToTimeStr: toHachihiTime(`${c.to} 23:59:59`),
              pageIndex,
              PageSize: 200
            }, req.body.host, req.body.secret);

            if (!resp || resp.ErrorCode !== '000000') {
              throw new Error(resp?.ErrorMessage || resp?.ErrorCode || 'Lỗi khi gọi checkinhis');
            }

            const data: any[] = resp.Data || [];
            for (const item of data) {
              const rawTime = fromHachihiTime(item.CheckinTimeStr);
              r.added += addAttendanceLog(item.FacePersionId, rawTime, boxId, item.Temperature, Number(item.Similarity ?? item.similarity));
            }
            if (!data.length || pageIndex * 200 >= (resp.Total || 0)) break;
            pageIndex++;
          }
        } catch (err: any) {
          r.failedChunks.push(`${c.from}→${c.to}`);
          r.error = err.message;
        }
        saveDb(); // lưu sau mỗi đoạn để không mất dữ liệu đã tải nếu đoạn sau lỗi
      }
      results.push(r);
    }

    const added = results.reduce((a, r) => a + r.added, 0);
    const failed = results.filter(r => r.failedChunks.length > 0);
    const ok = failed.length === 0;
    const failText = failed
      .map(r => `${r.machine}: lỗi ${r.failedChunks.length}/${chunks.length} đoạn (${r.failedChunks.slice(0, 3).join(', ')}${r.failedChunks.length > 3 ? '…' : ''}) - ${r.error}`)
      .join('; ');

    return res.json({
      ok: ok || added > 0,
      complete: ok,
      added,
      results,
      message: ok
        ? `Đã đồng bộ thành công ${added} bản ghi chấm công từ ${targetMachines.length} máy`
        : `Đồng bộ chưa đầy đủ: +${added} bản ghi. ${failText}. Hãy tải lại các khoảng ngày lỗi.`
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

  // Có khoảng ngày -> trả đủ (báo cáo cần dữ liệu đầy đủ, không được cắt âm thầm).
  // Không có khoảng ngày -> mặc định chỉ lấy 3.000 bản ghi mới nhất cho màn hình tổng quan.
  const hasRange = !!(from || to);
  const limit = Number(req.query.limit) || (hasRange ? 500000 : 3000);
  res.setHeader('X-Total-Count', String(filtered.length));
  res.json(filtered.slice(0, limit));
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
    }, req.body.host, req.body.secret);
    if (r && r.ErrorCode === '000000') {
      return res.json({ ok: true, data: r });
    }
    return res.status(400).json({ ok: false, error: r?.ErrorMessage || 'Lỗi khi gửi lệnh SyncFace' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 15. Clear all persons on machine (/api/facereg/ClearAllPerson)
app.post('/api/clear-machine', async (req: Request, res: Response) => {
  try {
    const { machineBoxId } = req.body;
    if (!machineBoxId) {
      return res.status(400).json({ ok: false, error: 'Thiếu mã thiết bị' });
    }
    const r = await callHachihiApi('/api/facereg/ClearAllPerson', {
      MachineBoxId: machineBoxId
    }, req.body.host, req.body.secret);
    if (r && r.ErrorCode === '000000') {
      for (const e of Object.values(db.emp)) {
        e.machines = (e.machines || []).filter(x => x !== machineBoxId);
      }
      saveDb();
      return res.json({ ok: true, message: 'Đã xóa toàn bộ khuôn mặt trên máy. Thiết bị đang khởi động lại.' });
    }
    return res.status(400).json({ ok: false, error: r?.ErrorMessage || 'Lỗi khi xóa người dùng' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 16. Webhook: Real-time Checkin Callback from Hachihi Device
app.post('/callback/checkin', (req: Request, res: Response) => {
  const b = req.body;
  if (b.FacePersonId) {
    const rawTime = fromHachihiTime(b.CheckinTime) || nowVN();
    addAttendanceLog(b.FacePersonId, rawTime, b.MachineBoxId, b.Temperature);
    saveDb();
  }
  return res.json({ ErrorCode: '000000', ErrorMessage: 'Thành công' });
});

// 17. Webhook: Real-time Heartbeat Callback from Hachihi Device
app.post('/callback/heartbeat', (req: Request, res: Response) => {
  const b = req.body;
  if (b.MachineBoxId) {
    const rawTime = fromHachihiTime(b.MachineTime) || nowVN();
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

export { app, startAutoSyncJob };
export default app;
