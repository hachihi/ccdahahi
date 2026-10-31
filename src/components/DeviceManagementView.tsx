import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Wifi,
  WifiOff,
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
  Server,
  Clock,
  Zap,
  Power,
  ShieldCheck,
  Bookmark,
  BookmarkPlus,
  BookmarkCheck,
  Save,
  Layers,
  Edit3
} from 'lucide-react';
import { HachihiMachine, ConnectionSettings, AutoSyncConfig, SavedDeviceProfile } from '../types/hachihi';
import { useAuth } from '../context/AuthContext';
import { HachihiDataService } from '../services/hachihiService';

interface DeviceManagementViewProps {
  machines: HachihiMachine[];
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
  const [deviceType] = useState('HACHIHI FACE AI');
  const [deviceName, setDeviceName] = useState('');
  const [hostUrl, setHostUrl] = useState(settings.host || '');
  const [secretKey, setSecretKey] = useState(settings.secretKey || '');
  const [machineSerial, setMachineSerial] = useState(settings.serial || '');
  const [appKey, setAppKey] = useState(settings.appKey || 'k77hcPwEXB4LTdJv96mz');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Saved machine profiles state (Lưu lại thông số theo danh sách máy để dùng cho lần sau)
  const [savedProfiles, setSavedProfiles] = useState<SavedDeviceProfile[]>([]);
  const [saveToProfileList, setSaveToProfileList] = useState(true);
  const [selectedQuickProfileId, setSelectedQuickProfileId] = useState('');
  const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null);
  const [disconnectingBoxId, setDisconnectingBoxId] = useState<string | null>(null);

  // Auto-sync configuration state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(settings.autoSync?.enabled ?? true);
  const [autoSyncInterval, setAutoSyncInterval] = useState(settings.autoSync?.intervalMinutes || 5);
  const [autoSyncLogs, setAutoSyncLogs] = useState(settings.autoSync?.syncLogs ?? true);
  const [autoSyncHeartbeat, setAutoSyncHeartbeat] = useState(settings.autoSync?.syncHeartbeat ?? true);
  const [isSavingAutoSync, setIsSavingAutoSync] = useState(false);
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncConfig | undefined>(settings.autoSync);

  // Load saved device profiles from service
  const loadProfiles = useCallback(async () => {
    try {
      const list = await HachihiDataService.getDeviceProfiles();
      setSavedProfiles(list);
    } catch (e) {
      console.warn('Error loading device profiles:', e);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (settings.autoSync) {
      setAutoSyncEnabled(settings.autoSync.enabled ?? true);
      setAutoSyncInterval(settings.autoSync.intervalMinutes || 5);
      setAutoSyncLogs(settings.autoSync.syncLogs ?? true);
      setAutoSyncHeartbeat(settings.autoSync.syncHeartbeat ?? true);
      setAutoSyncStatus(settings.autoSync);
    }
  }, [settings.autoSync]);

  // Sync Face state
  const [syncFrom, setSyncFrom] = useState(machines[0]?.MachineBoxId || '');
  const [syncTo, setSyncTo] = useState(machines[1]?.MachineBoxId || '');
  const [isSyncingFaces, setIsSyncingFaces] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  // Clear all modal state
  const [clearTargetBox, setClearTargetBox] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // Quick load profile into form
  const handleSelectQuickProfile = (profileId: string) => {
    setSelectedQuickProfileId(profileId);
    if (!profileId) return;

    const prof = savedProfiles.find(p => p.id === profileId || p.serial === profileId);
    if (prof) {
      setHostUrl(prof.host);
      setMachineSerial(prof.serial);
      setDeviceName(prof.name);
      if (prof.secretKey) {
        setSecretKey(prof.secretKey);
      }
      if (prof.appKey) {
        setAppKey(prof.appKey);
      }
      showToast(`Đã nạp thông số máy "${prof.name}" (${prof.serial}) vào biểu mẫu`, 'info');
    }
  };

  // Save machine profile to list without necessarily connecting right away
  const handleSaveOnlyProfile = async () => {
    if (!hostUrl.trim()) {
      showToast('Vui lòng nhập Website / Domain của Hachihi', 'error');
      return;
    }
    if (!machineSerial.trim()) {
      showToast('Vui lòng nhập Serial máy (Mã thiết bị / MachineBoxId)', 'error');
      return;
    }

    setIsSavingProfile(true);
    let cleanHost = hostUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(cleanHost)) {
      cleanHost = 'https://' + cleanHost;
    }

    try {
      const res = await HachihiDataService.saveDeviceProfile({
        name: (deviceName.trim() || `Máy ${machineSerial.trim()}`),
        host: cleanHost,
        secretKey: secretKey.trim(),
        appKey: appKey.trim() || 'k77hcPwEXB4LTdJv96mz',
        serial: machineSerial.trim(),
        notes: `Lưu thủ công lúc ${new Date().toLocaleTimeString('vi-VN')}`
      });

      if (res.ok) {
        await loadProfiles();
        showToast('Đã lưu thông số máy vào danh sách để dùng cho lần sau!', 'success');
      } else {
        showToast(res.error || 'Lỗi khi lưu thông số máy', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi lưu: ' + err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Connect Device
  const handleConnectDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostUrl.trim()) {
      showToast('Vui lòng nhập Website / Domain của Hachihi (ví dụ: https://congty.hachihi.vn)', 'error');
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
      const res = await HachihiDataService.connectDevice(
        cleanHost,
        secretKey.trim(),
        machineSerial.trim(),
        deviceName.trim(),
        appKey.trim()
      );

      if (res.ok) {
        // If saveToProfileList is true, save parameters to saved list
        if (saveToProfileList) {
          await HachihiDataService.saveDeviceProfile({
            name: (deviceName.trim() || `Máy ${machineSerial.trim()}`),
            host: cleanHost,
            secretKey: secretKey.trim(),
            appKey: appKey.trim() || 'k77hcPwEXB4LTdJv96mz',
            serial: machineSerial.trim()
          });
          await loadProfiles();
        }

        onRefreshData();
        showToast(res.message || 'Kết nối máy chấm công Hachihi thành công!', 'success');
      } else {
        showToast(res.error || 'Kết nối thất bại. Vui lòng kiểm tra lại Domain, Key và Serial.', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect directly from Saved Profile (1-click)
  const handleConnectFromProfile = async (prof: SavedDeviceProfile) => {
    setConnectingProfileId(prof.id);
    try {
      const res = await HachihiDataService.connectSavedProfile(prof.id);
      if (res.ok) {
        onRefreshData();
        await loadProfiles();
        showToast(res.message || `Đã kết nối thành công máy ${prof.name} (${prof.serial})!`, 'success');
      } else {
        showToast(res.error || 'Lỗi khi kết nối máy từ hồ sơ đã lưu', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setConnectingProfileId(null);
    }
  };

  // Disconnect directly from Saved Profile
  const handleDisconnectFromProfile = async (prof: SavedDeviceProfile) => {
    if (!confirm(`Bạn có chắc muốn ngắt kết nối máy "${prof.name}" (Serial: ${prof.serial}) khỏi hệ thống?`)) {
      return;
    }
    setDisconnectingBoxId(prof.serial);
    try {
      const res = await HachihiDataService.disconnectSavedProfile(prof.id);
      if (res.ok) {
        onRefreshData();
        await loadProfiles();
        showToast(`Đã ngắt kết nối máy "${prof.name}"`, 'info');
      } else {
        showToast('Không thể ngắt kết nối máy', 'error');
      }
    } finally {
      setDisconnectingBoxId(null);
    }
  };

  // Delete profile from saved list
  const handleDeleteProfile = async (prof: SavedDeviceProfile) => {
    if (!confirm(`Xóa cấu hình máy "${prof.name}" (${prof.serial}) khỏi danh sách lưu?`)) {
      return;
    }
    await HachihiDataService.deleteDeviceProfile(prof.id);
    await loadProfiles();
    showToast(`Đã xóa máy "${prof.name}" khỏi danh sách cấu hình đã lưu`, 'info');
  };

  // Disconnect machine by BoxId (Active machine list)
  const handleDisconnectMachine = async (boxId: string, machineName?: string) => {
    const displayName = machineName || boxId;
    if (!confirm(`Bạn có chắc chắn muốn ngắt kết nối máy "${displayName}" (Mã: ${boxId})? (Dữ liệu trên máy vật lý vẫn an toàn nguyên vẹn)`)) {
      return;
    }
    setDisconnectingBoxId(boxId);
    try {
      const ok = await HachihiDataService.disconnectMachine(boxId);
      if (ok) {
        onRefreshData();
        await loadProfiles();
        showToast(`Đã ngắt kết nối máy "${displayName}" thành công`, 'info');
      } else {
        showToast('Không thể ngắt kết nối máy', 'error');
      }
    } finally {
      setDisconnectingBoxId(null);
    }
  };

  // Test / Ping connection
  const handleTestConnection = async () => {
    if (!hostUrl.trim()) {
      showToast('Vui lòng nhập Domain Hachihi trước khi kiểm tra', 'error');
      return;
    }
    setIsTesting(true);
    let cleanHost = hostUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(cleanHost)) {
      cleanHost = 'https://' + cleanHost;
    }

    try {
      const res = await HachihiDataService.testConnection(cleanHost, secretKey.trim(), appKey.trim());
      if (res.ok) {
        const foundCount = res.machines?.length || 0;
        showToast(
          `Kết nối thành công tới ${cleanHost}! Tìm thấy ${foundCount} máy chấm công trên tài khoản.`,
          'success'
        );
      } else {
        showToast(res.error || 'Không kết nối được tới máy chủ Hachihi', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi kiểm tra: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // Save Auto-Sync Configuration
  const handleSaveAutoSync = async () => {
    setIsSavingAutoSync(true);
    try {
      const res = await HachihiDataService.updateAutoSync({
        enabled: autoSyncEnabled,
        intervalMinutes: Number(autoSyncInterval),
        syncLogs: autoSyncLogs,
        syncHeartbeat: autoSyncHeartbeat
      });
      if (res && res.ok) {
        if (res.autoSync) setAutoSyncStatus(res.autoSync);
        onRefreshData();
        showToast(res.message || 'Đã lưu cấu hình tự động đồng bộ định kỳ', 'success');
      } else {
        showToast(res?.message || 'Lỗi khi lưu cấu hình đồng bộ', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
    } finally {
      setIsSavingAutoSync(false);
    }
  };

  // Trigger Immediate Auto-Sync
  const handleTriggerAutoSyncNow = async () => {
    setIsTriggeringSync(true);
    try {
      const res = await HachihiDataService.triggerAutoSync();
      if (res && res.ok) {
        if (res.autoSync) setAutoSyncStatus(res.autoSync);
        onRefreshData();
        showToast(res.message || `Đã đồng bộ thành công (+${res.added ?? 0} lượt mới)`, 'success');
      } else {
        showToast(res?.message || 'Lỗi khi kích hoạt đồng bộ', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi đồng bộ: ' + err.message, 'error');
    } finally {
      setIsTriggeringSync(false);
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
      const res = await HachihiDataService.syncFaces(syncFrom, syncTo);
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
      const res = await HachihiDataService.clearMachine(clearTargetBox);
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
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Kết nối máy chấm công Hachihi
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nhập thông số hoặc chọn từ danh sách đã lưu
                  </p>
                </div>
              </div>

              {savedProfiles.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {savedProfiles.length} máy đã lưu
                </span>
              )}
            </div>

            {/* Quick Profile Selector */}
            {savedProfiles.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-emerald-500" />
                  Chọn từ danh sách máy đã lưu để điền nhanh:
                </label>
                <select
                  value={selectedQuickProfileId}
                  onChange={e => handleSelectQuickProfile(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">-- Chọn máy cần kết nối --</option>
                  {savedProfiles.map(p => {
                    const isConn = machines.some(m => m.MachineBoxId === p.serial);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} (Serial: {p.serial}) {isConn ? '• [Đang kết nối]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <form onSubmit={handleConnectDevice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Website / Domain của Hachihi *
                </label>
                <input
                  type="text"
                  required
                  value={hostUrl}
                  onChange={e => setHostUrl(e.target.value)}
                  placeholder="https://ten_mien.hachihi.vn"
                  className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Địa chỉ web do Hachihi cấp riêng cho đơn vị của bạn.
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
                  Lấy tại: Web Hachihi &rarr; Cài đặt &rarr; Tích hợp API &rarr; "Api Secret Key".
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
                  Lấy tại: Web Hachihi &rarr; Thiết bị &rarr; Cột "Tên thiết bị", dãy số dòng dưới.
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

              {/* Save parameters checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToProfileList}
                    onChange={e => setSaveToProfileList(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Lưu lại thông số theo danh sách máy để dùng cho lần sau
                  </span>
                </label>
                <p className="text-[10px] text-slate-400 pl-6 mt-0.5">
                  Lưu Domain, Key và Serial vào danh mục để lần sau chỉ cần 1 click là kết nối lại được ngay.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleTestConnection}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs transition"
                >
                  {isTesting ? 'Đang ping...' : 'Kiểm tra API (Ping)'}
                </button>

                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={handleSaveOnlyProfile}
                  className="px-3 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-semibold text-xs transition flex items-center gap-1.5"
                  title="Lưu thông số máy này vào danh sách mà chưa kết nối ngay"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingProfile ? 'Đang lưu...' : 'Lưu thông số'}
                </button>

                {canManageDevices ? (
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-500/20 disabled:opacity-50 transition min-w-[130px]"
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
        </div>

        {/* Connected Devices Table (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-emerald-500" />
                  Máy đang kết nối ({machines.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Danh sách máy chấm công nhận diện khuôn mặt trực tuyến và nút ngắt kết nối từng máy
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
                          Điền Website Hachihi, Api Secret Key và Serial máy ở khung bên trái hoặc chọn từ danh sách đã lưu rồi bấm "Kết nối máy".
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
                            Đang kết nối
                          </span>
                        </td>
                        <td className="py-3 pr-2 text-right space-x-1.5 whitespace-nowrap">
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

                          {/* Dedicated Disconnect Button for Individual Machine */}
                          {canManageDevices && (
                            <button
                              onClick={() => handleDisconnectMachine(m.MachineBoxId, m.MachineName)}
                              disabled={disconnectingBoxId === m.MachineBoxId}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                              title="Ngắt kết nối máy này khỏi hệ thống"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{disconnectingBoxId === m.MachineBoxId ? 'Đang ngắt...' : 'Ngắt kết nối'}</span>
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
              Đồng bộ toàn bộ dữ liệu khuôn mặt đã đăng ký từ máy nguồn sang máy đích theo chuẩn API Hachihi.
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

      {/* ======================= DANH SÁCH THÔNG SỐ MÁY ĐÃ LƯU (DÙNG CHO LẦN SAU) ======================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Danh Sách Thông Số Máy Đã Lưu (Sử dụng cho lần sau)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {savedProfiles.length} hồ sơ máy
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lưu giữ thông số Domain, Serial, Key của từng máy để tái kết nối nhanh chóng và có nút ngắt kết nối cho từng máy riêng biệt.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadProfiles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới danh sách
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="pb-3 pl-3">Tên thiết bị</th>
                <th className="pb-3">Serial máy (BoxId)</th>
                <th className="pb-3">Địa chỉ Domain / Host</th>
                <th className="pb-3">Lần kết nối gần nhất</th>
                <th className="pb-3 text-center">Trạng thái kết nối</th>
                <th className="pb-3 pr-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {savedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                    <BookmarkPlus className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Chưa có thông số máy nào được lưu
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Khi bấm "Kết nối máy" ở trên, tích chọn ô <em>"Lưu lại thông số theo danh sách máy để dùng cho lần sau"</em> để tự động lưu thông số vào đây.
                    </p>
                  </td>
                </tr>
              ) : (
                savedProfiles.map(prof => {
                  const isConnected = machines.some(m => m.MachineBoxId === prof.serial);

                  return (
                    <tr key={prof.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 pl-3 font-sans font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <HardDrive className={`w-4 h-4 ${isConnected ? 'text-emerald-500' : 'text-slate-400'}`} />
                          <span>{prof.name}</span>
                        </div>
                      </td>

                      <td className="py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {prof.serial}
                      </td>

                      <td className="py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={prof.host}>
                        {prof.host}
                      </td>

                      <td className="py-3 text-slate-500 dark:text-slate-400 font-sans">
                        {prof.lastConnected || 'Chưa kết nối'}
                      </td>

                      <td className="py-3 text-center font-sans">
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang kết nối
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Đã ngắt kết nối
                          </span>
                        )}
                      </td>

                      <td className="py-3 pr-3 text-right space-x-1.5 whitespace-nowrap font-sans">
                        {/* 1-Click Connect / Disconnect Buttons */}
                        {isConnected ? (
                          <button
                            onClick={() => handleDisconnectFromProfile(prof)}
                            disabled={disconnectingBoxId === prof.serial}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                            title="Ngắt kết nối máy này"
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{disconnectingBoxId === prof.serial ? 'Đang ngắt...' : 'Ngắt kết nối'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnectFromProfile(prof)}
                            disabled={connectingProfileId === prof.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                            title="Kết nối lại máy này với các thông số đã lưu"
                          >
                            <Wifi className="w-3.5 h-3.5" />
                            <span>{connectingProfileId === prof.id ? 'Đang kết nối...' : 'Kết nối lại'}</span>
                          </button>
                        )}

                        {/* Load into form to edit */}
                        <button
                          onClick={() => handleSelectQuickProfile(prof.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                          title="Tải thông số vào biểu mẫu để chỉnh sửa"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete from saved list */}
                        <button
                          onClick={() => handleDeleteProfile(prof)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition"
                          title="Xóa máy này khỏi danh sách lưu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-Sync Periodic Mode Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${autoSyncEnabled ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Chế độ Tự Động Đồng Bộ Định Kỳ (Periodic Auto-Sync)
                </h3>
                {autoSyncEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Đang kích hoạt ({autoSyncInterval} phút/lần)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    Đang tắt
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  Đã chuẩn hóa Header (Khắc phục 401 FARE0011)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hệ thống tự động tải lịch sử checkin (quẹt mặt) và ping trạng thái thiết bị theo chu kỳ nền mà không cần thao tác tay.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTriggerAutoSyncNow}
              disabled={isTriggeringSync || !settings.host}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition disabled:opacity-50"
              title="Kích hoạt chu kỳ đồng bộ ngay lập tức"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringSync ? 'animate-spin text-emerald-500' : ''}`} />
              {isTriggeringSync ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
            </button>

            <button
              onClick={handleSaveAutoSync}
              disabled={isSavingAutoSync}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSavingAutoSync ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>

        {/* Configuration Body */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Controls (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            {/* Toggle Enable/Disable */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Bật tự động đồng bộ ngầm định kỳ
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tự động gọi API máy Hachihi theo lịch trình nền để cập nhật chấm công mới
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={e => setAutoSyncEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Select Interval */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Chu kỳ chạy đồng bộ (Thời gian giữa 2 lần)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[1, 2, 5, 10, 15, 30].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setAutoSyncInterval(mins)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition ${
                      autoSyncInterval === mins
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {mins} phút
                  </button>
                ))}
              </div>
            </div>

            {/* Sync Options Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncLogs}
                  onChange={e => setAutoSyncLogs(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-medium">
                  Tự động tải lượt chấm công mới nhất (<code className="font-mono text-emerald-600">/api/facereg/checkinhis</code>)
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncHeartbeat}
                  onChange={e => setAutoSyncHeartbeat(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-medium">
                  Tự động kiểm tra trạng thái Online của máy (<code className="font-mono text-emerald-600">/api/faceid/getAllMachine</code>)
                </span>
              </label>
            </div>
          </div>

          {/* Real-time Status Panel (5 cols) */}
          <div className="md:col-span-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Trạng thái thực tế
                </span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  autoSyncStatus?.lastSyncStatus === 'success'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : autoSyncStatus?.lastSyncStatus === 'running'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : autoSyncStatus?.lastSyncStatus === 'error'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    autoSyncStatus?.lastSyncStatus === 'success' ? 'bg-emerald-500' :
                    autoSyncStatus?.lastSyncStatus === 'running' ? 'bg-amber-500 animate-pulse' :
                    autoSyncStatus?.lastSyncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'
                  }`} />
                  {autoSyncStatus?.lastSyncStatus === 'success' ? 'Hoạt động tốt' :
                   autoSyncStatus?.lastSyncStatus === 'running' ? 'Đang đồng bộ...' :
                   autoSyncStatus?.lastSyncStatus === 'error' ? 'Có cảnh báo' : 'Sẵn sàng'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Đồng bộ gần nhất:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {autoSyncStatus?.lastSyncTime || 'Chưa chạy lần nào'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Bản ghi thu thập:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{autoSyncStatus?.lastSyncAdded ?? 0} lượt mới
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block mb-1">Chi tiết kết quả:</span>
                  <p className="font-mono text-[11px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 break-words leading-relaxed">
                    {autoSyncStatus?.lastSyncMessage || 'Sẵn sàng khởi động đồng bộ'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 text-[10px] text-slate-400 italic">
              * Khuyến nghị: Chu kỳ 5 phút là tối ưu để không làm nghẽn băng thông thiết bị mà vẫn đảm bảo chấm công theo thời gian thực.
            </div>
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
              Để máy chấm công Hachihi tự động đẩy dữ liệu quẹt mặt tức thì về ứng dụng mà không cần bấm nút đồng bộ thủ công,
              vui lòng truy cập web Hachihi &rarr; <strong>Cài đặt &rarr; Tích hợp API</strong> và điền 2 đường dẫn sau:
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
