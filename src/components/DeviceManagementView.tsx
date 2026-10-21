import React, { useState } from 'react';
import {
  HardDrive,
  Wifi,
  Plus,
  RefreshCw,
  Copy,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Info,
  Check,
  Radio,
  Server
} from 'lucide-react';
import { DahahiMachine, ConnectionSettings } from '../types/dahahi';
import { useAuth } from '../context/AuthContext';
import { DahahiDataService } from '../services/dahahiService';

interface DeviceManagementViewProps {
  machines: DahahiMachine[];
  settings: ConnectionSettings;
  onRefreshData: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({
  machines,
  settings,
  onRefreshData,
  showToast
}) => {
  const { hasPermission } = useAuth();
  const canManageDevices = hasPermission('manage_devices');
  const canPerformDanger = hasPermission('danger_actions');

  // Connection form state
  const [deviceType] = useState('DAHAHI FACE AI');
  const [deviceName, setDeviceName] = useState('');
  const [hostUrl, setHostUrl] = useState(settings.host || '');
  const [secretKey, setSecretKey] = useState(settings.secretKey || '');
  const [machineSerial, setMachineSerial] = useState(settings.serial || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Sync Face state
  const [syncFrom, setSyncFrom] = useState(machines[0]?.MachineBoxId || '');
  const [syncTo, setSyncTo] = useState(machines[1]?.MachineBoxId || '');
  const [isSyncingFaces, setIsSyncingFaces] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  // Clear all modal state
  const [clearTargetBox, setClearTargetBox] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // Handle Connect Device
  const handleConnectDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostUrl.trim()) {
      showToast('Vui lòng nhập Website / Domain của Dahahi (ví dụ: https://congty.dahahi.vn)', 'error');
      return;
    }
    if (!secretKey.trim()) {
      showToast('Vui lòng nhập Api Secret Key', 'error');
      return;
    }
    if (!machineSerial.trim()) {
      showToast('Vui lòng nhập Serial máy (Mã thiết bị / MachineBoxId)', 'error');
      return;
    }

    setIsConnecting(true);
    let cleanHost = hostUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(cleanHost)) {
      cleanHost = 'https://' + cleanHost;
    }

    try {
      const res = await DahahiDataService.connectDevice(
        cleanHost,
        secretKey.trim(),
        machineSerial.trim(),
        deviceName.trim()
      );

      if (res.ok) {
        onRefreshData();
        showToast(res.message || 'Kết nối máy chấm công Dahahi thành công!', 'success');
        setDeviceName('');
      } else {
        showToast(res.error || 'Kết nối thất bại. Vui lòng kiểm tra lại Domain, Key và Serial.', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Test / Ping connection
  const handleTestConnection = async () => {
    if (!hostUrl.trim()) {
      showToast('Vui lòng nhập Domain Dahahi trước khi kiểm tra', 'error');
      return;
    }
    setIsTesting(true);
    let cleanHost = hostUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(cleanHost)) {
      cleanHost = 'https://' + cleanHost;
    }

    try {
      const res = await DahahiDataService.testConnection(cleanHost, secretKey.trim());
      if (res.ok) {
        const foundCount = res.machines?.length || 0;
        showToast(
          `Kết nối thành công tới ${cleanHost}! Tìm thấy ${foundCount} máy chấm công trên tài khoản.`,
          'success'
        );
      } else {
        showToast(res.error || 'Không kết nối được tới máy chủ Dahahi', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi kiểm tra: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // Disconnect machine
  const handleDisconnectMachine = async (boxId: string) => {
    if (!confirm(`Bạn có chắc muốn ngắt kết nối máy ${boxId} khỏi hệ thống quản lý? (Dữ liệu trên máy vật lý không bị xóa)`)) {
      return;
    }
    const ok = await DahahiDataService.disconnectMachine(boxId);
    if (ok) {
      onRefreshData();
      showToast(`Đã ngắt kết nối máy ${boxId}`, 'info');
    } else {
      showToast('Không thể ngắt kết nối máy', 'error');
    }
  };

  // Sync Faces between machines (/api/facereg/SyncFace)
  const handleSyncFaces = async () => {
    if (!syncFrom || !syncTo) {
      showToast('Vui lòng chọn đầy đủ máy nguồn và máy đích', 'error');
      return;
    }
    if (syncFrom === syncTo) {
      showToast('Máy nguồn và máy đích phải khác nhau', 'error');
      return;
    }

    const mFrom = machines.find(m => m.MachineBoxId === syncFrom)?.MachineName || syncFrom;
    const mTo = machines.find(m => m.MachineBoxId === syncTo)?.MachineName || syncTo;

    if (!confirm(`Xác nhận sao chép toàn bộ khuôn mặt từ máy "${mFrom}" sang máy "${mTo}"?`)) {
      return;
    }

    setIsSyncingFaces(true);
    setSyncProgress('Đang gửi lệnh sao chép...');
    try {
      const res = await DahahiDataService.syncFaces(syncFrom, syncTo);
      if (res && res.ok) {
        showToast(`Đã gửi lệnh sao chép toàn bộ khuôn mặt sang máy ${mTo} thành công!`, 'success');
      } else {
        showToast(res?.error || 'Lỗi khi gửi lệnh SyncFace', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi đồng bộ: ' + err.message, 'error');
    } finally {
      setIsSyncingFaces(false);
      setSyncProgress(null);
    }
  };

  // Clear all faces on machine (/api/facereg/ClearAllPerson)
  const handleExecuteClearAll = async () => {
    if (confirmInput.trim() !== 'XACNHAN') {
      showToast('Vui lòng gõ chính xác "XACNHAN" để xác thực lệnh xóa nguy hiểm', 'error');
      return;
    }
    if (!clearTargetBox) return;

    setIsClearing(true);
    try {
      const res = await DahahiDataService.clearMachine(clearTargetBox);
      if (res && res.ok) {
        onRefreshData();
        showToast(`Đã xóa toàn bộ khuôn mặt trên máy ${clearTargetBox}. Thiết bị đang khởi động lại.`, 'success');
        setClearTargetBox(null);
        setConfirmInput('');
      } else {
        showToast(res?.error || 'Lỗi khi xóa khuôn mặt', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi xóa: ' + err.message, 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label} vào bộ nhớ tạm`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Grid: Connection Form & Connected Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form: Add Device Connection (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                Kết nối máy chấm công Dahahi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kết nối trực tiếp qua Domain, API Key và Serial máy
              </p>
            </div>
          </div>

          <form onSubmit={handleConnectDevice} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Loại thiết bị
              </label>
              <input
                type="text"
                value={deviceType}
                disabled
                className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                1. Website / Domain của Dahahi *
              </label>
              <input
                type="text"
                required
                value={hostUrl}
                onChange={e => setHostUrl(e.target.value)}
                placeholder="https://ten_mien.dahahi.vn"
                className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Địa chỉ web do Dahahi cấp riêng cho đơn vị của bạn.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                2. Api Secret Key *
              </label>
              <input
                type="password"
                required
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="Dán Api Secret Key"
                className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Lấy tại: Web Dahahi &rarr; Cài đặt &rarr; Tích hợp API &rarr; "Api Secret Key".
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                3. Serial máy (Mã thiết bị / MachineBoxId) *
              </label>
              <input
                type="text"
                required
                value={machineSerial}
                onChange={e => setMachineSerial(e.target.value)}
                placeholder="Ví dụ: 1468063 hoặc MAC0000001"
                className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Lấy tại: Web Dahahi &rarr; Thiết bị &rarr; Cột "Tên thiết bị", dãy số dòng dưới.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên thiết bị gợi nhớ (Tùy chọn)
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="Ví dụ: Cửa Chính Văn Phòng"
                className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={isTesting}
                onClick={handleTestConnection}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs transition"
              >
                {isTesting ? 'Đang ping...' : 'Kiểm tra API (Ping)'}
              </button>

              {canManageDevices ? (
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  <Wifi className="w-4 h-4" />
                  {isConnecting ? 'Đang kết nối...' : 'Kết nối máy'}
                </button>
              ) : (
                <p className="text-xs text-rose-500 italic flex-1 text-center">
                  Cần quyền Quản lý thiết bị
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Connected Devices Table (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-emerald-500" />
                  Máy đã kết nối ({machines.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Danh sách máy chấm công nhận diện khuôn mặt trực tuyến
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-3 pl-2">Tên thiết bị</th>
                    <th className="pb-3">Serial (BoxId)</th>
                    <th className="pb-3">Mã máy</th>
                    <th className="pb-3">Trạng thái</th>
                    <th className="pb-3 pr-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {machines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <HardDrive className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          Chưa kết nối máy nào
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Điền Website Dahahi, Api Secret Key và Serial máy ở khung bên trái rồi bấm "Kết nối máy".
                        </p>
                      </td>
                    </tr>
                  ) : (
                    machines.map(m => (
                      <tr key={m.MachineBoxId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 pl-2">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {m.MachineName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Báo online: {m.lastSeen || 'Vừa kết nối'}
                          </p>
                        </td>
                        <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {m.MachineBoxId}
                        </td>
                        <td className="py-3 font-mono text-slate-600 dark:text-slate-400">
                          {m.MachineCode || `MAC${m.MachineBoxId}`}
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                        </td>
                        <td className="py-3 pr-2 text-right space-x-1 whitespace-nowrap">
                          {canPerformDanger && (
                            <button
                              onClick={() => {
                                setClearTargetBox(m.MachineBoxId);
                                setConfirmInput('');
                              }}
                              className="px-2 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 font-medium transition text-xs"
                              title="Xóa toàn bộ khuôn mặt trên máy này"
                            >
                              Xóa mặt
                            </button>
                          )}
                          {canManageDevices && (
                            <button
                              onClick={() => handleDisconnectMachine(m.MachineBoxId)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                              title="Ngắt kết nối máy"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sync Face between devices (API SyncFace) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500" />
              Sao chép khuôn mặt giữa các máy (SyncFace)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Đồng bộ toàn bộ dữ liệu khuôn mặt đã đăng ký từ máy nguồn sang máy đích theo chuẩn API Dahahi.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Máy nguồn (FromMachineBoxId)
                </label>
                <select
                  value={syncFrom}
                  onChange={e => setSyncFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {machines.length === 0 ? (
                    <option value="">Chưa có máy</option>
                  ) : (
                    machines.map(m => (
                      <option key={m.MachineBoxId} value={m.MachineBoxId}>
                        {m.MachineName} ({m.MachineBoxId})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Máy đích nhận (ToMachineBoxId)
                </label>
                <select
                  value={syncTo}
                  onChange={e => setSyncTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {machines.length === 0 ? (
                    <option value="">Chưa có máy</option>
                  ) : (
                    machines.map(m => (
                      <option key={m.MachineBoxId} value={m.MachineBoxId}>
                        {m.MachineName} ({m.MachineBoxId})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {syncProgress && (
              <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {syncProgress}
              </p>
            )}

            <button
              onClick={handleSyncFaces}
              disabled={isSyncingFaces || machines.length < 2}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFaces ? 'animate-spin' : ''}`} />
              Thực hiện sao chép khuôn mặt
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Callback Information */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Cấu hình Nhận chấm công tức thời (CallBack & HeartBeat Webhook)
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Để máy chấm công Dahahi tự động đẩy dữ liệu quẹt mặt tức thì về ứng dụng mà không cần bấm nút đồng bộ thủ công,
              vui lòng truy cập web Dahahi &rarr; <strong>Cài đặt &rarr; Tích hợp API</strong> và điền 2 đường dẫn sau:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  CallBack Api Url (Nhận sự kiện checkin tức thời)
                </span>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-xs text-emerald-600 dark:text-emerald-400 font-mono break-all">
                    {window.location.origin}/callback/checkin
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/callback/checkin`, 'CallBack URL')}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  Heat Beat Api Url (Báo máy Online định kỳ)
                </span>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-xs text-teal-600 dark:text-teal-400 font-mono break-all">
                    {window.location.origin}/callback/heartbeat
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/callback/heartbeat`, 'HeartBeat URL')}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Modal: Clear All Persons on Machine */}
      {clearTargetBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white text-center">
              Cảnh báo: Xóa toàn bộ khuôn mặt trên máy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 text-center mt-2 leading-relaxed">
              Bạn đang yêu cầu gọi API <code className="font-mono text-rose-600">/api/facereg/ClearAllPerson</code> cho máy{' '}
              <strong>{clearTargetBox}</strong>. Toàn bộ khuôn mặt trên thiết bị sẽ bị xóa vĩnh viễn và thiết bị sẽ tự động khởi động lại.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gõ <strong className="text-rose-600">XACNHAN</strong> để thực hiện:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder="XACNHAN"
                className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-bold tracking-widest text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setClearTargetBox(null);
                  setConfirmInput('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={confirmInput !== 'XACNHAN' || isClearing}
                onClick={handleExecuteClearAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/20 disabled:opacity-50 transition"
              >
                {isClearing ? 'Đang thực hiện...' : 'Xóa toàn bộ trên máy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
