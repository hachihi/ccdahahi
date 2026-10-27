import { DahahiMachine, Employee, AttendanceLog, ConnectionSettings, MonthlyReportRow, AutoSyncConfig } from '../types/dahahi';

export const DEFAULT_SETTINGS: ConnectionSettings = {
  host: '',
  appKey: 'k77hcPwEXB4LTdJv96mz',
  secretKey: '',
  serial: '',
  workStartTime: '08:30',
  workEndTime: '17:30',
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
const LS_SETTINGS = 'dahahi_vcl_settings';
const LS_MACHINES = 'dahahi_vcl_machines';
const LS_EMPLOYEES = 'dahahi_vcl_employees';
const LS_LOGS = 'dahahi_vcl_logs';

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

// Formats "YYYY-MM-DD HH:mm:ss" to Dahahi format "dd/MM/yyyy HH:mm:ss"
export const toDahahiTimeStr = (str?: string): string => {
  if (!str) return '';
  const clean = str.replace('T', ' ');
  const [datePart, timePart = '00:00:00'] = clean.split(' ');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return str;
  const timeFormatted = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${pad2(+d)}/${pad2(+m)}/${y} ${timeFormatted}`;
};

// Formats Dahahi "dd/MM/yyyy HH:mm:ss" to "YYYY-MM-DD HH:mm:ss"
export const fromDahahiTimeStr = (str?: string): string => {
  if (!str) return '';
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):?(\d{0,2})/.exec(str);
  if (!match) return str;
  const [, d, m, y, h, min, s] = match;
  return `${y}-${pad2(+m)}-${pad2(+d)} ${pad2(+h)}:${pad2(+min)}:${pad2(+(s || 0))}`;
};

export const stripBase64Prefix = (s?: string): string => {
  return (s || '').replace(/^data:image\/\w+;base64,/, '');
};

// Shrink image to <= 480px JPEG to prevent device packet overflow (Dahahi hardware limit ~1MB)
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

// Real Dahahi Data Service calling the Backend API with Vercel Serverless Cache Resiliency
export class DahahiDataService {
  // Direct Dahahi API call via server proxy
  static async callDahahiApi(endpoint: string, body: Record<string, any> = {}): Promise<any> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/dahahi/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        body,
        host: cachedSettings.host,
        secret: cachedSettings.secretKey
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

  // Connect to Dahahi machine based on domain, key, and serial
  static async connectDevice(host: string, secret: string, serial: string, name?: string): Promise<{ ok: boolean; message?: string; error?: string; device?: any }> {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, secret, serial, name })
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Lỗi giao tiếp máy chủ' }));
    if (json.ok) {
      const currentSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
      setLocalItem(LS_SETTINGS, {
        ...currentSettings,
        host,
        secretKey: secret,
        serial
      });
      if (json.device) {
        const currentMachines = getLocalItem<DahahiMachine[]>(LS_MACHINES, []);
        const filtered = currentMachines.filter(m => m.MachineBoxId !== json.device.box);
        const newMachine: DahahiMachine = {
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
  static async testConnection(host?: string, secret?: string): Promise<{ ok: boolean; machines?: any[]; error?: string }> {
    const cachedSettings = getLocalItem<ConnectionSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const res = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: host || cachedSettings.host,
        secret: secret || cachedSettings.secretKey
      })
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Không kết nối được' }));
    return json;
  }

  // Get connected machines
  static async getMachines(): Promise<DahahiMachine[]> {
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
    return getLocalItem<DahahiMachine[]>(LS_MACHINES, []);
  }

  // Disconnect a machine
  static async disconnectMachine(boxId: string): Promise<boolean> {
    const current = getLocalItem<DahahiMachine[]>(LS_MACHINES, []);
    setLocalItem(LS_MACHINES, current.filter(m => m.MachineBoxId !== boxId));
    const res = await fetch(`/api/machines/${encodeURIComponent(boxId)}`, {
      method: 'DELETE'
    });
    return res.ok;
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
  static async saveEmployee(emp: Partial<Employee>): Promise<{ ok: boolean; employee?: Employee; pushResults?: Record<string, string>; error?: string; warn?: string }> {
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

  // Delete employee from machine and database
  static async deleteEmployee(id: string): Promise<{ ok: boolean; machineResults?: Record<string, string>; error?: string }> {
    const current = getLocalItem<Employee[]>(LS_EMPLOYEES, []);
    setLocalItem(LS_EMPLOYEES, current.filter(e => e.id !== id));
    const res = await fetch(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE'
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

  // Download all employees from Dahahi Cloud (/api/facereg/GetEmployeeList)
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
}
