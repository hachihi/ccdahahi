import {
  HachihiMachine,
  Employee,
  AttendanceLog,
  ConnectionSettings,
  MonthlyReportRow,
  AutoSyncConfig,
  SavedDeviceProfile,
  DeviceDetailReportRow,
  DetailedShiftReportRow,
  ShiftConfig,
  TimesheetTemplate,
  AuditLogItem,
  SyncHistoryItem
} from '../types/hachihi';


export const DEFAULT_SETTINGS: ConnectionSettings = {
  host: '',
  appKey: 'k77hcPwEXB4LTdJv96mz',
  secretKey: '',
  serial: '',
  workStartTime: '08:00',
  workEndTime: '17:00',
  callbackCheckinUrl: typeof window !== 'undefined' ? `${window.location.origin}/callback/checkin` : '',
  callbackHeartbeatUrl: typeof window !== 'undefined' ? `${window.location.origin}/callback/heartbeat` : '',
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

// Local storage keys for resilient Vercel serverless caching
const LS_SETTINGS = 'hachihi_vcl_settings';
const LS_MACHINES = 'hachihi_vcl_machines';
const LS_EMPLOYEES = 'hachihi_vcl_employees';
const LS_LOGS = 'hachihi_vcl_logs';
const LS_PROFILES = 'hachihi_vcl_profiles';


const getLocalItem = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
};

const setLocalItem = (key: string, val: any) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

// Date helpers
export const pad2 = (n: number) => String(n).padStart(2, '0');

export const formatIsoDateTime = (d: Date = new Date()) => {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// Formats "YYYY-MM-DD HH:mm:ss" to Hachihi format "dd/MM/yyyy HH:mm:ss"
export const toHachihiTimeStr = (str?: string): string => {
  if (!str) return '';
  const clean = str.replace('T', ' ');
  const [datePart, timePart = '00:00:00'] = clean.split(' ');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return str;
  const timeFormatted = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${pad2(+d)}/${pad2(+m)}/${y} ${timeFormatted}`;
};

// Formats Hachihi "dd/MM/yyyy HH:mm:ss" to "YYYY-MM-DD HH:mm:ss"
export const fromHachihiTimeStr = (str?: string): string => {
  if (!str) return '';
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):?(\d{0,2})/.exec(str);
  if (!match) return str;
  const [, d, m, y, h, min, s] = match;
  return `${y}-${pad2(+m)}-${pad2(+d)} ${pad2(+h)}:${pad2(+min)}:${pad2(+(s || 0))}`;
};

export const stripBase64Prefix = (s?: string): string => {
  return (s || '').replace(/^data:image\/\w+;base64,/, '');
};

// Shrink image to <= 480px JPEG to prevent device packet overflow (Hachihi hardware limit ~1MB)
export const shrinkImage = (fileOrBlob: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 480;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không khởi tạo được bộ xử lý đồ họa'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Tệp không phải là ảnh hợp lệ hoặc bị hỏng'));
    };
    img.src = url;
  });
};

// Download face photo directly to user PC
export const downloadFaceImage = (photoDataOrUrl: string, employeeId: string, employeeName: string) => {
  const link = document.createElement('a');
  link.href = photoDataOrUrl;
  const safeName = (employeeName || 'khuon_mat').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  link.download = `face_${employeeId}_${safeName}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Download CSV file with UTF-8 BOM so Excel opens Vietnamese characters without broken fonts
export const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const bom = '\ufeff';
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Parse uploaded CSV text
export const parseCsv = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const clean = text.replace(/^\ufeff/, '').trim();
  const lines = clean.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }

  return { headers, rows };
};

// Real Hachihi Data Service calling the Backend API with Vercel Serverless Cache Resiliency
export class HachihiDataService {
  // Direct Hachihi API call via server proxy
  static async callHachihiApi(endpoint: string, body: Record<string, any> = {}): Promise<any> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/hachihi/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        body,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey,
        appKey: cachedSettings.appKey
      })
    });
    return await res.json();
  }

  // Get settings (merges server and localStorage for Vercel cold starts)
  static async getSettings(): Promise<ConnectionSettings> {
    const cached = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const merged: ConnectionSettings = {
          host: data.host || cached.host || '',
          appKey: data.appKey || cached.appKey || 'k77hcPwEXB4LTdJv96mz',
          secretKey: data.hasSecret ? '••••••••' : (cached.secretKey || ''),
          serial: data.serial || cached.serial || '',
          workStartTime: data.workStart || cached.workStartTime || '08:30',
          workEndTime: '17:30',
          callbackCheckinUrl: `${window.location.origin}/callback/checkin`,
          callbackHeartbeatUrl: `${window.location.origin}/callback/heartbeat`,
          autoSync: data.autoSync || cached.autoSync
        };
        if (data.host) {
          setLocalItem(LS_SETTINGS, { ...cached, host: data.host, serial: data.serial, autoSync: merged.autoSync });
        }
        return merged;
      }
    } catch (e) {
      console.warn('Could not fetch settings from server:', e);
    }
    return cached;
  }

  // Get Auto-Sync Configuration
  static async getAutoSync(): Promise<AutoSyncConfig> {
    try {
      const res = await fetch('/api/sync/auto');
      if (res.ok) {
        const data = await res.json();
        return data.autoSync;
      }
    } catch (e) {
      console.warn('Could not get auto sync config:', e);
    }
    const cached = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    return cached.autoSync || DEFAULT_SETTINGS.autoSync!;
  }

  // Update Auto-Sync Configuration
  static async updateAutoSync(config: Partial<AutoSyncConfig>): Promise<{ ok: boolean; autoSync?: AutoSyncConfig; message?: string }> {
    try {
      const res = await fetch('/api/sync/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.ok && data.autoSync) {
        const current = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
        setLocalItem(LS_SETTINGS, { ...current, autoSync: data.autoSync });
      }
      return data;
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  // Trigger Immediate Auto-Sync Run
  static async triggerAutoSync(): Promise<{ ok: boolean; added?: number; message?: string; autoSync?: AutoSyncConfig }> {
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.autoSync) {
        const current = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
        setLocalItem(LS_SETTINGS, { ...current, autoSync: data.autoSync });
      }
      return data;
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  // Connect to Hachihi machine based on domain, key, and serial
  static async connectDevice(host: string, secret: string, serial: string, name?: string, appKey?: string): Promise<{ ok: boolean; message?: string; error?: string; device?: any }> {
    const currentSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const finalAppKey = (appKey || currentSettings.appKey || 'k77hcPwEXB4LTdJv96mz').trim();
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, secret, serial, name, appKey: finalAppKey })
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Lỗi giao tiếp máy chủ' }));
    if (json.ok) {
      setLocalItem(LS_SETTINGS, {
        ...currentSettings,
        host,
        secretKey: secret,
        appKey: finalAppKey,
        serial
      });
      if (json.device) {
        const currentMachines = getLocalItem<HachihiMachine[]>(LS_MACHINES, []);
        const filtered = currentMachines.filter(m => m.MachineBoxId !== json.device.box);
        const newMachine: HachihiMachine = {
          MachineName: json.device.name,
          MachineCode: json.device.code || `MAC${json.device.box}`,
          MachineBoxId: json.device.box,
          lastSeen: json.device.lastSeen,
          isOnline: true
        };
        setLocalItem(LS_MACHINES, [...filtered, newMachine]);
      }
    }
    return json;
  }

  // Test / Ping connection
  static async testConnection(host?: string, secret?: string, appKey?: string): Promise<{ ok: boolean; machines?: any[]; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const finalAppKey = (appKey || cachedSettings.appKey || 'k77hcPwEXB4LTdJv96mz').trim();
    const res = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: host || cachedSettings.host,
        secret: secret || cachedSettings.secretKey,
        appKey: finalAppKey
      })
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Không kết nối được' }));
    return json;
  }

  // Get connected machines
  static async getMachines(): Promise<HachihiMachine[]> {
    try {
      const res = await fetch('/api/machines');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setLocalItem(LS_MACHINES, list);
          return list;
        }
      }
    } catch (e) {
      console.warn('Error fetching machines:', e);
    }
    // Fallback to local cache for Vercel cold restarts
    return getLocalItem<HachihiMachine[]>(LS_MACHINES, []);
  }

  // Disconnect a machine
  static async disconnectMachine(boxId: string): Promise<boolean> {
    const current = getLocalItem<HachihiMachine[]>(LS_MACHINES, []);
    setLocalItem(LS_MACHINES, current.filter(m => m.MachineBoxId !== boxId));
    try {
      const res = await fetch(`/api/machines/${encodeURIComponent(boxId)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  // Get Saved Device Profiles (Danh sách thông số máy đã lưu)
  static async getDeviceProfiles(): Promise<SavedDeviceProfile[]> {
    try {
      const res = await fetch('/api/device-profiles');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          setLocalItem(LS_PROFILES, list);
          return list;
        }
      }
    } catch (e) {
      console.warn('Error fetching device profiles:', e);
    }
    return getLocalItem<SavedDeviceProfile[]>(LS_PROFILES, []);
  }

  // Save / Update Device Profile
  static async saveDeviceProfile(profile: Partial<SavedDeviceProfile>): Promise<{ ok: boolean; profile?: SavedDeviceProfile; error?: string }> {
    try {
      const res = await fetch('/api/device-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (data.ok && data.profile) {
        const current = getLocalItem<SavedDeviceProfile[]>(LS_PROFILES, []);
        const filtered = current.filter(p => p.id !== data.profile.id && p.serial !== data.profile.serial);
        setLocalItem(LS_PROFILES, [...filtered, data.profile]);
      }
      return data;
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // Delete Saved Device Profile
  static async deleteDeviceProfile(id: string): Promise<boolean> {
    const current = getLocalItem<SavedDeviceProfile[]>(LS_PROFILES, []);
    setLocalItem(LS_PROFILES, current.filter(p => p.id !== id && p.serial !== id));
    try {
      const res = await fetch(`/api/device-profiles/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  // Connect via Saved Device Profile
  static async connectSavedProfile(id: string): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/device-profiles/${encodeURIComponent(id)}/connect`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.ok) {
        await this.getMachines();
      }
      return data;
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // Disconnect via Saved Device Profile
  static async disconnectSavedProfile(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch(`/api/device-profiles/${encodeURIComponent(id)}/disconnect`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.ok) {
        await this.getMachines();
      }
      return data;
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  // Get employees from server DB or localStorage
  static async getEmployees(): Promise<Employee[]> {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setLocalItem(LS_EMPLOYEES, list);
          return list;
        }
      }
    } catch (e) {
      console.warn('Error fetching employees:', e);
    }
    return getLocalItem<Employee[]>(LS_EMPLOYEES, []);
  }

  // Save / Update employee and push to machine
  static async saveEmployee(emp: Partial<Employee>): Promise<{ ok: boolean; employee?: Employee; pushResults?: Record<string, string>; failedMachines?: string[]; error?: string; warn?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...emp,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
      })
    });
    const json = await res.json();
    if (json.ok && json.employee) {
      const current = getLocalItem<Employee[]>(LS_EMPLOYEES, []);
      const idx = current.findIndex(e => e.id === json.employee.id);
      let updated: Employee[];
      if (idx >= 0) {
        updated = current.map(e => e.id === json.employee.id ? json.employee : e);
      } else {
        updated = [json.employee, ...current];
      }
      setLocalItem(LS_EMPLOYEES, updated);
    }
    return json;
  }

  // Xóa nhân viên: chỉ xóa khỏi bộ nhớ trình duyệt SAU KHI máy chủ xác nhận đã xóa.
  // force = true: xóa khỏi hệ thống kể cả khi máy chưa xóa được.
  static async deleteEmployee(
    id: string,
    force = false
  ): Promise<{ ok: boolean; deleted?: boolean; pending?: boolean; forced?: boolean; machineResults?: Record<string, string>; warn?: string; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch(`/api/employees/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: cachedSettings.host, secret: cachedSettings.secretKey, force })
    });
    const json = await res.json();
    if (json.ok && json.deleted) {
      const current = getLocalItem<Employee[]>(LS_EMPLOYEES, []);
      setLocalItem(LS_EMPLOYEES, current.filter(e => e.id !== id));
    }
    return json;
  }

  // Thử lại các mục chưa đồng bộ của một nhân viên
  static async retryEmployee(id: string): Promise<{ ok: boolean; deleted?: boolean; stillFailing?: boolean; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch(`/api/employees/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: cachedSettings.host, secret: cachedSettings.secretKey })
    });
    return await res.json();
  }

  // Thử lại hàng loạt, mỗi lần một lô nhỏ. Gọi lại cho tới khi remaining = 0.
  static async retryFailedEmployees(limit = 15): Promise<{ ok: boolean; processed?: number; fixed?: number; removed?: number; remaining?: number; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/employees/retry-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, host: cachedSettings.host, secret: cachedSettings.secretKey })
    });
    return await res.json();
  }

  // Download all employees and faces from machine (/api/facereg/searchByName + /api/facereg/getInfo)
  static async pullEmployeesFromMachine(machineBoxId?: string): Promise<{ ok: boolean; count?: number; photoCount?: number; message?: string; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/pull-machine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineBoxId,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
      })
    });
    const json = await res.json();
    if (json.ok) {
      // Re-fetch to update local cache
      const freshList = await this.getEmployees();
      setLocalItem(LS_EMPLOYEES, freshList);
    }
    return json;
  }

  // Download all employees from Hachihi Cloud (/api/facereg/GetEmployeeList)
  static async pullEmployeesFromCloud(): Promise<{ ok: boolean; count?: number; photoCount?: number; message?: string; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/pull-cloud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
      })
    });
    const json = await res.json();
    if (json.ok) {
      const freshList = await this.getEmployees();
      setLocalItem(LS_EMPLOYEES, freshList);
    }
    return json;
  }

  // Pull face photo for single employee
  static async pullFaceForEmployee(id: string, machineBoxId?: string): Promise<{ ok: boolean; photo?: string; message?: string; error?: string; errorCode?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch(`/api/employees/${encodeURIComponent(id)}/pull-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: cachedSettings.host,
        secret: cachedSettings.secretKey,
        m: machineBoxId
      })
    });
    const json = await res.json();
    if (json.ok && json.photo) {
      const current = getLocalItem<Employee[]>(LS_EMPLOYEES, []);
      const updated = current.map(e => e.id === id ? { ...e, photo: json.photo, hasPhoto: true, registeredFace: true } : e);
      setLocalItem(LS_EMPLOYEES, updated);
    }
    return json;
  }

  // Download checkin history from machine (/api/facereg/checkinhis)
  static async syncLogsFromMachine(from?: string, to?: string, machineBoxId?: string): Promise<{ ok: boolean; added?: number; message?: string; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        m: machineBoxId,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
      })
    });
    const json = await res.json();
    if (json.ok) {
      const freshLogs = await this.getLogs();
      setLocalItem(LS_LOGS, freshLogs);
    }
    return json;
  }

  // Lấy ĐỦ log của một khoảng ngày cho báo cáo (không cắt 3.000 dòng, không ghi đè bộ nhớ đệm)
  static async fetchLogsRange(from: string, to: string): Promise<{ ok: boolean; logs: AttendanceLog[]; error?: string }> {
    try {
      const q = new URLSearchParams({ from, to });
      const res = await fetch(`/api/logs?${q.toString()}`);
      if (!res.ok) return { ok: false, logs: [], error: `Máy chủ trả lỗi HTTP ${res.status}` };
      const list = await res.json();
      if (!Array.isArray(list)) return { ok: false, logs: [], error: 'Dữ liệu trả về không hợp lệ' };
      const total = Number(res.headers.get('X-Total-Count') || list.length);
      if (total > list.length) {
        return { ok: false, logs: list, error: `Chỉ nhận được ${list.length}/${total} bản ghi` };
      }
      return { ok: true, logs: list };
    } catch (e: any) {
      return { ok: false, logs: [], error: e?.message || 'Không kết nối được máy chủ' };
    }
  }

  // Get attendance logs
  static async getLogs(query: { from?: string; to?: string; m?: string; pid?: string } = {}): Promise<AttendanceLog[]> {
    try {
      const q = new URLSearchParams();
      if (query.from) q.append('from', query.from);
      if (query.to) q.append('to', query.to);
      if (query.m && query.m !== 'all') q.append('m', query.m);
      if (query.pid) q.append('pid', query.pid);

      const res = await fetch(`/api/logs?${q.toString()}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setLocalItem(LS_LOGS, list);
          return list;
        }
      }
    } catch (e) {
      console.warn('Error fetching logs:', e);
    }
    return getLocalItem<AttendanceLog[]>(LS_LOGS, []);
  }

  // Sync faces between 2 machines
  static async syncFaces(from: string, to: string): Promise<{ ok: boolean; data?: any; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/sync-faces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
      })
    });
    return await res.json();
  }

  // Clear all faces on machine
  static async clearMachine(machineBoxId: string): Promise<{ ok: boolean; message?: string; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/clear-machine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineBoxId,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
      })
    });
    return await res.json();
  }

  // Monthly report calculation from real logs
  static calculateMonthlyReport(logs: AttendanceLog[], employees: Employee[], monthStr: string, workStart: string = '08:30'): MonthlyReportRow[] {
    const empMap = new Map(employees.map(e => [e.id, e]));
    const map = new Map<string, Map<string, string[]>>();

    for (const log of logs) {
      if (log.time.startsWith(monthStr)) {
        const day = log.time.slice(8, 10);
        const timePart = log.time.slice(11, 16);
        if (!map.has(log.pid)) {
          map.set(log.pid, new Map());
        }
        const dayMap = map.get(log.pid)!;
        if (!dayMap.has(day)) {
          dayMap.set(day, []);
        }
        dayMap.get(day)!.push(timePart);
      }
    }

    const timeToMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const targetStartMins = timeToMins(workStart);
    const result: MonthlyReportRow[] = [];

    const allPids = Array.from(new Set([...employees.map(e => e.id), ...Array.from(map.keys())]));

    for (const pid of allPids) {
      const emp = empMap.get(pid);
      const dayMap = map.get(pid) || new Map();
      const daysObj: Record<string, [string, string]> = {};
      let totalMinutes = 0;
      let lateCount = 0;

      for (const [day, times] of dayMap.entries()) {
        times.sort();
        const firstIn = times[0];
        const lastOut = times[times.length - 1];
        daysObj[day] = [firstIn, lastOut];

        const inMins = timeToMins(firstIn);
        const outMins = timeToMins(lastOut);

        if (outMins > inMins) {
          totalMinutes += (outMins - inMins);
        } else {
          totalMinutes += 4 * 60;
        }

        if (inMins > targetStartMins) {
          lateCount++;
        }
      }

      result.push({
        pid,
        name: emp?.name || `(Mã NV: ${pid})`,
        department: emp?.department || 'Chung',
        days: daysObj,
        workDays: dayMap.size,
        hours: +(totalMinutes / 60).toFixed(1),
        late: lateCount
      });
    }

    return result.sort((a, b) => a.pid.localeCompare(b.pid, undefined, { numeric: true }));
  }

  // Mẫu 1: Báo cáo chấm công chi tiết theo máy
  // Cột: Mã NV, Tên NV, Ngày, Máy, Lần 1, Lần 2, Lần 3...
  static calculateDeviceDetailReport(
    logs: AttendanceLog[],
    employees: Employee[],
    machines: HachihiMachine[],
    options: {
      monthStr?: string;
      dateStr?: string;
      machineBoxId?: string;
      pid?: string;
    } = {}
  ): { rows: DeviceDetailReportRow[]; maxPunches: number } {
    const empMap = new Map(employees.map(e => [e.id, e]));
    const machineMap = new Map(machines.map(m => [m.MachineBoxId, m.MachineName]));

    const groups = new Map<string, { pid: string; date: string; m: string; name: string; punches: string[] }>();

    for (const log of logs) {
      if (!log.time) continue;
      const datePart = log.time.slice(0, 10);
      if (options.monthStr && !datePart.startsWith(options.monthStr)) continue;
      if (options.dateStr && datePart !== options.dateStr) continue;
      if (options.machineBoxId && options.machineBoxId !== 'all' && log.m !== options.machineBoxId) continue;
      if (options.pid && options.pid !== 'all' && log.pid !== options.pid) continue;

      const key = `${log.pid}___${datePart}___${log.m || 'DEF'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          pid: log.pid,
          date: datePart,
          m: log.m || '',
          name: log.name,
          punches: []
        });
      }
      const timePart = log.time.length >= 19 ? log.time.slice(11, 19) : log.time.slice(11, 16);
      groups.get(key)!.punches.push(timePart);
    }

    let maxPunches = 1;
    const rows: DeviceDetailReportRow[] = [];

    for (const item of groups.values()) {
      item.punches.sort();
      if (item.punches.length > maxPunches) {
        maxPunches = item.punches.length;
      }

      const emp = empMap.get(item.pid);
      const machineName = machineMap.get(item.m) || (item.m ? `Máy ${item.m}` : 'Thiết bị Hachihi');

      rows.push({
        employeeCode: emp?.code || item.pid,
        employeeName: emp?.name || item.name || `NV ${item.pid}`,
        date: item.date,
        machine: item.m ? `${machineName} (${item.m})` : machineName,
        punches: item.punches
      });
    }

    rows.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true });
    });

    return { rows, maxPunches: Math.max(maxPunches, 3) };
  }

  // Mẫu 2: Báo cáo chấm công chi tiết theo ca
  // Cột: STT, Mã NV, Họ và tên, Phòng ban, Ngày, Vào Sớm Nhất (MIN), Ra Muộn Nhất (MAX), Mã Ca, Giờ Vào Chuẩn, Giờ Ra Chuẩn, Phút vào Trễ, Phút về Sớm, Giờ công
  static calculateDetailedShiftReport(
    logs: AttendanceLog[],
    employees: Employee[],
    options: {
      monthStr?: string;
      dateStr?: string;
      standardIn?: string;
      standardOut?: string;
      shiftCode?: string;
      pid?: string;
      department?: string;
    } = {}
  ): DetailedShiftReportRow[] {
    const empMap = new Map(employees.map(e => [e.id, e]));
    const standardIn = options.standardIn || '08:00';
    const standardOut = options.standardOut || '17:00';
    const shiftCode = options.shiftCode || 'HC';

    const timeToMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const stdInMins = timeToMins(standardIn);
    const stdOutMins = timeToMins(standardOut);

    const groups = new Map<string, { pid: string; date: string; name: string; times: string[] }>();

    for (const log of logs) {
      if (!log.time) continue;
      const datePart = log.time.slice(0, 10);
      if (options.monthStr && !datePart.startsWith(options.monthStr)) continue;
      if (options.dateStr && datePart !== options.dateStr) continue;
      if (options.pid && options.pid !== 'all' && log.pid !== options.pid) continue;

      const emp = empMap.get(log.pid);
      if (options.department && options.department !== 'all' && emp?.department !== options.department) continue;

      const key = `${log.pid}___${datePart}`;
      if (!groups.has(key)) {
        groups.set(key, {
          pid: log.pid,
          date: datePart,
          name: log.name,
          times: []
        });
      }
      const timeHm = log.time.slice(11, 16);
      groups.get(key)!.times.push(timeHm);
    }

    const rows: DetailedShiftReportRow[] = [];

    for (const item of groups.values()) {
      item.times.sort();
      const minIn = item.times[0];
      const maxOut = item.times[item.times.length - 1];

      const emp = empMap.get(item.pid);
      const minInMins = timeToMins(minIn);
      const maxOutMins = timeToMins(maxOut);

      // Phút vào Trễ
      const lateMinutes = minInMins > stdInMins ? Math.max(0, minInMins - stdInMins) : 0;

      // Phút về Sớm
      const earlyMinutes = maxOutMins < stdOutMins ? Math.max(0, stdOutMins - maxOutMins) : 0;

      // Giờ công
      let workHours = 8.0;
      if (item.times.length === 1) {
        workHours = 4.0;
      } else {
        const totalWorkMinutes = Math.max(0, 480 - lateMinutes - earlyMinutes);
        workHours = Math.max(0, Math.min(8.0, +(totalWorkMinutes / 60).toFixed(1)));
      }

      rows.push({
        stt: 0,
        employeeCode: emp?.code || item.pid,
        employeeName: emp?.name || item.name || `NV ${item.pid}`,
        department: emp?.department || 'Khối văn phòng',
        date: item.date,
        minIn,
        maxOut,
        shiftCode,
        standardIn,
        standardOut,
        lateMinutes,
        earlyMinutes,
        workHours
      });
    }

    rows.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true });
    });

    return rows.map((r, idx) => ({ ...r, stt: idx + 1 }));
  }

  // ==================== AUTH HEADERS HELPER ====================
  private static getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
      const rawUser = localStorage.getItem('hachihi_current_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        return {
          'x-user-role': u.role || 'SUPER_ADMIN',
          'x-user-name': encodeURIComponent(u.fullName || u.username || 'Admin')
        };
      }
    } catch {}
    return { 'x-user-role': 'SUPER_ADMIN', 'x-user-name': 'Admin' };
  }

  // ==================== MODULE 6: CA LÀM VIỆC & CẤU HÌNH TÍNH CÔNG ====================
  static async getShifts(): Promise<ShiftConfig[]> {
    try {
      const res = await fetch('/api/shifts');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch shifts:', e);
    }
    return [
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
      }
    ];
  }

  static async saveShift(shift: ShiftConfig): Promise<{ ok: boolean; shifts?: ShiftConfig[]; error?: string }> {
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(shift)
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  static async deleteShift(code: string): Promise<{ ok: boolean; shifts?: ShiftConfig[]; error?: string }> {
    try {
      const res = await fetch(`/api/shifts/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // ==================== MODULE 7: MẪU BẢNG CÔNG TÙY BIẾN ====================
  static async getTimesheetTemplates(): Promise<TimesheetTemplate[]> {
    try {
      const res = await fetch('/api/timesheet-templates');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch templates:', e);
    }
    return [];
  }

  static async saveTimesheetTemplate(template: Partial<TimesheetTemplate>): Promise<{ ok: boolean; templates?: TimesheetTemplate[]; error?: string }> {
    try {
      const res = await fetch('/api/timesheet-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(template)
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  static async deleteTimesheetTemplate(id: string): Promise<{ ok: boolean; templates?: TimesheetTemplate[]; error?: string }> {
    try {
      const res = await fetch(`/api/timesheet-templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // ==================== MODULE 4: CHỐNG TRÙNG LẶP DỮ LIỆU ====================
  static async deduplicateAttendance(): Promise<{ ok: boolean; removedCount?: number; totalRemaining?: number; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/attendance/deduplicate', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // ==================== MODULE 8: AUDIT LOGS & BACKUP/RESTORE ====================
  static async getAuditLogs(): Promise<AuditLogItem[]> {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch audit logs:', e);
    }
    return [];
  }

  static async logAudit(action: string, target: string, status: 'SUCCESS' | 'WARNING' | 'ERROR' = 'SUCCESS', details?: string): Promise<void> {
    try {
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ action, target, status, details })
      });
    } catch {}
  }

  static async getSyncHistory(): Promise<SyncHistoryItem[]> {
    try {
      const res = await fetch('/api/sync-history');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch sync history:', e);
    }
    return [];
  }

  static async restoreSystemBackup(payload: any): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/system/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}

export { HachihiDataService as DahahiDataService };

