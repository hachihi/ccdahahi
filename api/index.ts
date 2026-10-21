import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const app = express();

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// On Vercel serverless, /tmp is writable across warm invocations
const TMP_DIR = process.env.VERCEL ? '/tmp' : path.resolve('.');
const SETTINGS_FILE = path.join(TMP_DIR, 'settings.json');
const DATA_FILE = path.join(TMP_DIR, 'data.json');

interface SettingsData {
  host: string;
  appKey: string;
  secret: string;
  serial: string;
  devices: { name: string; box: string; code?: string; lastSeen?: string }[];
  workStart: string;
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
}

// In-memory state (fast warm container response)
let settings: SettingsData = {
  host: process.env.DAHAHI_HOST || '',
  appKey: process.env.APP_KEY || 'k77hcPwEXB4LTdJv96mz',
  secret: process.env.SECRET_KEY || '',
  serial: process.env.DAHAHI_SERIAL || '',
  devices: [],
  workStart: process.env.WORK_START || '08:30'
};

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    settings = { ...settings, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('Could not read settings from disk:', e);
}

const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving settings:', e);
  }
};

let db: DbData = { emp: {}, logs: [], seen: {} };
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    db = { ...db, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('Could not read data from disk:', e);
}

const saveDb = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving data:', e);
  }
};

const pad2 = (n: number) => String(n).padStart(2, '0');

// Format "yyyy-MM-dd HH:mm:ss" -> "dd/MM/yyyy HH:mm:ss"
const toDahahiTime = (s?: string): string => {
  if (!s) return '';
  const clean = s.replace('T', ' ');
  const [datePart, timePart = '00:00:00'] = clean.split(' ');
  const parts = datePart.split('-');
  if (parts.length < 3) return s;
  const [y, m, d] = parts;
  const timeFormatted = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${pad2(Number(d))}/${pad2(Number(m))}/${y} ${timeFormatted}`;
};

// Format Dahahi "dd/MM/yyyy HH:mm:ss" -> "yyyy-MM-dd HH:mm:ss"
const fromDahahiTime = (s?: string): string => {
  if (!s) return '';
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):?(\d{0,2})/.exec(s);
  if (!m) return s;
  return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))} ${pad2(Number(m[4]))}:${pad2(Number(m[5]))}:${pad2(Number(m[6] || 0))}`;
};

const stripBase64 = (s?: string) => (s || '').replace(/^data:image\/\w+;base64,/, '');

// Extract image from any possible field in Dahahi response
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

// Real HTTP call to Dahahi API with timeout and robust error parsing
async function callDahahiApi(endpoint: string, body: Record<string, any> = {}, customHost?: string, customSecret?: string, timeoutMs: number = 8000) {
  const host = (customHost || settings.host || '').trim().replace(/\/$/, '');
  const secret = (customSecret || settings.secret || '').trim();
  const appKey = settings.appKey || 'k77hcPwEXB4LTdJv96mz';

  if (!host) {
    throw new Error('Chưa cấu hình Website của Dahahi (domain)');
  }
  if (!secret) {
    throw new Error('Chưa cấu hình Api Secret Key của Dahahi');
  }

  const url = `${host}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': appKey,
        'SecretKey': secret,
        'appkey': appKey,
        'secretkey': secret
      },
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
      return {
        ErrorCode: 'FARE0011',
        ErrorMessage: 'Không có quyền truy cập (401 Unauthorized). Kiểm tra lại Api Secret Key và Website Dahahi.',
        httpStatus: 401,
        raw: rawText
      };
    }

    if (response.status === 404) {
      return {
        ErrorCode: '404',
        ErrorMessage: `Endpoint ${endpoint} không tồn tại trên hệ thống Dahahi (404 Not Found)`,
        httpStatus: 404,
        raw: rawText
      };
    }

    if (!response.ok && (!json || typeof json !== 'object' || !json.ErrorCode)) {
      return {
        ErrorCode: `HTTP_${response.status}`,
        ErrorMessage: `Lỗi kết nối Dahahi HTTP ${response.status}: ${rawText.slice(0, 120)}`,
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
        ErrorMessage: `Quá thời gian phản hồi (${timeoutMs / 1000}s) từ máy chủ Dahahi khi gọi ${endpoint}`,
        timeout: true
      };
    }
    throw err;
  }
}

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

// ==================== API ROUTES ====================

app.post('/api/dahahi/call', async (req: Request, res: Response) => {
  try {
    const { endpoint, body, host, secret } = req.body;
    if (!endpoint) {
      return res.status(400).json({ ErrorCode: 'ERR_PARAM', ErrorMessage: 'Thiếu endpoint API' });
    }
    const result = await callDahahiApi(endpoint, body || {}, host, secret);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ ErrorCode: 'ERR_PROXY', ErrorMessage: e.message });
  }
});

app.get('/api/settings', (req: Request, res: Response) => {
  res.json({
    host: settings.host,
    appKey: settings.appKey,
    hasSecret: !!settings.secret,
    serial: settings.serial,
    workStart: settings.workStart,
    devices: settings.devices
  });
});

app.post('/api/connect', async (req: Request, res: Response) => {
  try {
    let host = String(req.body.host || '').trim().replace(/\/$/, '');
    if (host && !/^https?:\/\//i.test(host)) {
      host = 'https://' + host;
    }
    const secret = String(req.body.secret || '').trim() || settings.secret;
    const serial = String(req.body.serial || req.body.box || '').trim();
    const name = String(req.body.name || '').trim();

    if (!host) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Website / Domain của Dahahi' });
    }
    if (!secret) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Api Secret Key' });
    }
    if (!serial) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Serial máy (Mã thiết bị / MachineBoxId)' });
    }

    const r = await callDahahiApi('/api/faceid/getAllMachine', {}, host, secret);

    if (!r || r.ErrorCode !== '000000') {
      const errMsg = r?.ErrorMessage || 'Lỗi xác thực với máy chủ Dahahi';
      return res.status(400).json({
        ok: false,
        error: `Không thể kết nối tới ${host}: ${r?.ErrorCode || 'LỖI'} - ${errMsg}. Vui lòng kiểm tra lại Api Secret Key.`
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
        error: `Kết nối tài khoản Dahahi thành công, nhưng không tìm thấy serial "${serial}". Các mã thiết bị hiện có trên tài khoản: ${availableSerials || '(Chưa có máy nào)'}`
      });
    }

    settings.host = host;
    settings.secret = secret;
    settings.serial = serial;

    const boxId = String(matched.MachineBoxId);
    const existingIndex = settings.devices.findIndex(d => d.box === boxId);
    const deviceItem = {
      name: name || matched.MachineName || `Máy Dahahi ${boxId}`,
      box: boxId,
      code: matched.MachineCode,
      lastSeen: db.seen[boxId] || new Date().toISOString().replace('T', ' ').slice(0, 19)
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
    return res.status(500).json({
      ok: false,
      error: `Không thể kết nối tới máy chủ: ${err.message}`
    });
  }
});

app.post('/api/test', async (req: Request, res: Response) => {
  try {
    const host = req.body.host ? String(req.body.host).trim().replace(/\/$/, '') : settings.host;
    const secret = req.body.secret ? String(req.body.secret).trim() : settings.secret;

    const r = await callDahahiApi('/api/faceid/getAllMachine', {}, host, secret);
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

app.delete('/api/machines/:boxId', (req: Request, res: Response) => {
  const { boxId } = req.params;
  settings.devices = settings.devices.filter(d => d.box !== boxId);
  saveSettings();
  res.json({ ok: true });
});

app.get('/api/employees', (req: Request, res: Response) => {
  const list = Object.values(db.emp).map(e => ({
    ...e,
    hasPhoto: !!e.photo,
    registeredFace: !!e.photo
  })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  res.json(list);
});

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

    const pushResults: Record<string, string> = {};
    if (updated.photo && updated.machines.length > 0) {
      const cleanPhoto = stripBase64(updated.photo);
      for (const mId of updated.machines) {
        try {
          const r = await callDahahiApi('/api/facereg/edit', {
            FacePersionId: updated.id,
            MachineBoxId: mId,
            FullName: updated.name,
            Base64Image: cleanPhoto,
            FromTimeStr: toDahahiTime(updated.from),
            ToTimeStr: toDahahiTime(updated.to)
          }, b.host, b.secret);
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
        const r = await callDahahiApi('/api/facereg/remove', {
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
      const r = await callDahahiApi('/api/facereg/searchByName', {
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
            let info = await callDahahiApi('/api/facereg/getInfo', {
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
              info = await callDahahiApi('/api/facereg/getInfo', {
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

// 11. Download / Pull employees from Dahahi Cloud (v2.0 / Company registry)
app.post('/api/pull-cloud', async (req: Request, res: Response) => {
  try {
    const host = (req.body.host || settings.host || '').trim().replace(/\/$/, '');
    const secret = (req.body.secret || settings.secret || '').trim();
    let count = 0;
    let photoCount = 0;

    // Step 1: Query company-wide registry via /api/facereg/searchByName with MachineBoxId: ''
    let pageIndex = 1;

    for (;;) {
      const r = await callDahahiApi('/api/facereg/searchByName', {
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
        const r = await callDahahiApi('/api/facereg/GetEmployeeList', {
          FullName: '',
          PageIndex: pageIndex,
          pageIndex: pageIndex,
          PageSize: 100,
          pageSize: 100,
          getPicture: 1
        }, host, secret);

        if (!r || (r.ErrorCode !== '000000' && !Array.isArray(r.Data) && !Array.isArray(r.data))) {
          if (count === 0) {
            throw new Error(r?.ErrorMessage || `Máy chủ Dahahi phản hồi lỗi: ${r?.ErrorCode || 'Lỗi kết nối'}`);
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
          let info = await callDahahiApi('/api/facereg/getInfo', {
            FacePersionId: id,
            FacePersonId: id,
            PersonId: id,
            MachineBoxId: targetBox,
            getPicture: 1
          }, host, secret, 3500);

          let extracted = extractImageFromData(info?.Data) || extractImageFromData(info);
          if (!extracted) {
            info = await callDahahiApi('/api/facereg/getInfo', {
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
      message: `Đã tải xuống thành công ${count} nhân sự từ Cloud Dahahi (kèm ${photoCount} ảnh khuôn mặt)`
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
    let info = await callDahahiApi('/api/facereg/getInfo', {
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
      info = await callDahahiApi('/api/facereg/getInfo', {
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
      const searchRes = await callDahahiApi('/api/facereg/searchByName', {
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
        const r = await callDahahiApi('/api/facereg/checkinhis', {
          MachineBoxId: boxId,
          FacePersionId: '',
          FromTimeStr: toDahahiTime(fromStr),
          ToTimeStr: toDahahiTime(toStr),
          pageIndex,
          PageSize: 200
        }, req.body.host, req.body.secret);

        if (!r || r.ErrorCode !== '000000') {
          throw new Error(r?.ErrorMessage || 'Lỗi khi gọi checkinhis');
        }

        const data: any[] = r.Data || [];
        for (const item of data) {
          const rawTime = fromDahahiTime(item.CheckinTimeStr);
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

app.post('/api/sync-faces', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'Thiếu máy nguồn hoặc máy đích' });
    }
    const r = await callDahahiApi('/api/facereg/SyncFace', {
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

app.post('/api/clear-machine', async (req: Request, res: Response) => {
  try {
    const { machineBoxId } = req.body;
    if (!machineBoxId) {
      return res.status(400).json({ ok: false, error: 'Thiếu mã thiết bị' });
    }
    const r = await callDahahiApi('/api/facereg/ClearAllPerson', {
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

app.post('/callback/checkin', (req: Request, res: Response) => {
  const b = req.body;
  if (b.FacePersonId) {
    const rawTime = fromDahahiTime(b.CheckinTime) || new Date().toISOString().replace('T', ' ').slice(0, 19);
    addAttendanceLog(b.FacePersonId, rawTime, b.MachineBoxId, b.Temperature);
    saveDb();
  }
  return res.json({ ErrorCode: '000000', ErrorMessage: 'Thành công' });
});

app.post('/callback/heartbeat', (req: Request, res: Response) => {
  const b = req.body;
  if (b.MachineBoxId) {
    const rawTime = fromDahahiTime(b.MachineTime) || new Date().toISOString().replace('T', ' ').slice(0, 19);
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

// Vercel serverless export
export default app;
