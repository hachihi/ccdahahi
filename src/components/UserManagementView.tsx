import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Check,
  X,
  AlertCircle,
  KeyRound,
  Shield,
  CheckCircle2,
  FileText,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  ShieldAlert,
  History,
  Database
} from 'lucide-react';
import { SystemUser, RoleType, PermissionKey, AuditLogItem } from '../types/hachihi';
import { useAuth } from '../context/AuthContext';
import { PERMISSION_LIST } from '../mock/sampleData';
import { HachihiDataService } from '../services/hachihiService';

interface UserManagementViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ showToast }) => {
  const {
    currentUser,
    users,
    roles,
    hasPermission,
    addUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    updateRolePermissions
  } = useAuth();

  const canManageUsers = hasPermission('manage_users');
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'matrix' | 'audit' | 'backup'>('users');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'SUCCESS' | 'WARNING' | 'ERROR'>('ALL');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Backup & Restore state
  const [restoreJson, setRestoreJson] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await HachihiDataService.getAuditLogs();
      setAuditLogs(logs);
    } catch (e: any) {
      showToast('Lỗi tải nhật ký: ' + e.message, 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeSubTab]);


  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<RoleType>('HR_MANAGER');
  const [formPassword, setFormPassword] = useState('');
  const [formCustomPerms, setFormCustomPerms] = useState<PermissionKey[]>([]);

  const handleOpenModal = (user?: SystemUser) => {
    if (user) {
      setEditingUser(user);
      setFormUsername(user.username);
      setFormFullName(user.fullName);
      setFormEmail(user.email);
      setFormRole(user.role);
      setFormPassword('');
      setFormCustomPerms(user.customPermissions || []);
    } else {
      setEditingUser(null);
      setFormUsername('');
      setFormFullName('');
      setFormEmail('');
      setFormRole('HR_MANAGER');
      setFormPassword('');
      setFormCustomPerms([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      showToast('Vui lòng nhập tên đăng nhập', 'error');
      return;
    }
    if (!formFullName.trim()) {
      showToast('Vui lòng nhập họ và tên', 'error');
      return;
    }

    try {
      if (editingUser) {
        updateUser(editingUser.id, {
          username: formUsername.trim(),
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          role: formRole,
          customPermissions: formRole === 'CUSTOM' ? formCustomPerms : undefined
        });
        showToast(`Đã cập nhật thông tin người dùng ${formFullName}`, 'success');
      } else {
        // Check duplicate
        if (users.some(u => u.username.toLowerCase() === formUsername.trim().toLowerCase())) {
          showToast('Tên đăng nhập đã tồn tại trong hệ thống', 'error');
          return;
        }
        addUser({
          username: formUsername.trim(),
          fullName: formFullName.trim(),
          email: formEmail.trim() || `${formUsername.trim()}@congty.vn`,
          role: formRole,
          isActive: true,
          customPermissions: formRole === 'CUSTOM' ? formCustomPerms : undefined
        });
        showToast(`Đã tạo tài khoản ${formFullName} thành công`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu tài khoản', 'error');
    }
  };

  const handleDelete = (user: SystemUser) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${user.fullName}" (${user.username})?`)) return;
    try {
      deleteUser(user.id);
      showToast(`Đã xóa người dùng ${user.fullName}`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleActive = (user: SystemUser) => {
    try {
      toggleUserStatus(user.id);
      showToast(`Đã ${user.isActive ? 'khóa' : 'mở khóa'} tài khoản ${user.fullName}`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub Tab Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeSubTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Danh sách người dùng ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeSubTab === 'matrix'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Ma trận quyền (RBAC)
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeSubTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Nhật ký hoạt động (Audit)
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeSubTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            Sao lưu & Khôi phục
          </button>
        </div>

        {canManageUsers && activeSubTab === 'users' && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition"
          >
            <UserPlus className="w-4 h-4" />
            Tạo tài khoản mới
          </button>
        )}
      </div>


      {/* Tab 1: Users List */}
      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 pl-6">Người dùng</th>
                  <th className="py-3.5 px-4">Tên đăng nhập</th>
                  <th className="py-3.5 px-4">Vai trò hệ thống</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Đăng nhập gần nhất</th>
                  <th className="py-3.5 pr-6 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map(u => {
                  const roleObj = roles.find(r => r.id === u.role);
                  const isCurrent = u.id === currentUser.id;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Avatar & Full Name */}
                      <td className="py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar}
                            alt={u.fullName}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {u.fullName} {isCurrent && <span className="text-[10px] text-emerald-500 font-bold ml-1">(Bạn)</span>}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {u.username}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            roleObj?.badgeColor || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {roleObj?.name || u.role}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
                            <Lock className="w-3.5 h-3.5" /> Bị khóa
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {u.lastLogin || 'Chưa ghi nhận'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManageUsers && (
                            <>
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={isCurrent}
                                className={`p-1.5 rounded-lg transition disabled:opacity-40 ${
                                  u.isActive
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                }`}
                                title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              >
                                {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleOpenModal(u)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Chỉnh sửa người dùng & phân quyền"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDelete(u)}
                                disabled={isCurrent || users.length <= 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-30"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Permissions Matrix (RBAC) */}
      {activeSubTab === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6">
          <div className="mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-500" />
              Bảng ma trận phân quyền chi tiết (Role-Based Access Control)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Quyền hạn áp dụng cho từng vai trò người dùng trong toàn bộ ứng dụng quản lý máy chấm công Hachihi.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold min-w-[200px]">
                    Tính năng & Quyền hạn
                  </th>
                  {roles.map(r => (
                    <th key={r.id} className="py-3 px-4 text-center font-bold">
                      <span className={`px-2.5 py-1 rounded-lg border ${r.badgeColor}`}>
                        {r.name.split('(')[0].trim()}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {PERMISSION_LIST.map(perm => (
                  <tr key={perm.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {perm.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {perm.description}
                      </p>
                    </td>

                    {roles.map(r => {
                      const hasPerm = r.permissions.includes(perm.key);
                      const isSuperAdmin = r.id === 'SUPER_ADMIN';

                      return (
                        <td key={r.id} className="py-3.5 px-4 text-center">
                          {isSuperAdmin ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 mx-auto">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={!canManageUsers}
                              onClick={() => {
                                const newPerms = hasPerm
                                  ? r.permissions.filter(k => k !== perm.key)
                                  : [...r.permissions, perm.key];
                                updateRolePermissions(r.id, newPerms);
                                showToast(`Đã cập nhật quyền "${perm.label}" cho vai trò ${r.name}`, 'success');
                              }}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition ${
                                hasPerm
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:ring-2 hover:ring-emerald-400'
                                  : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 hover:text-slate-400'
                              } ${!canManageUsers ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {hasPerm ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Logs */}

      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Lọc theo trạng thái:</span>
              {(['ALL', 'SUCCESS', 'WARNING', 'ERROR'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setAuditFilter(st)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                    auditFilter === st
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' && 'Tất cả'}
                  {st === 'SUCCESS' && 'Thành công'}
                  {st === 'WARNING' && 'Cảnh báo'}
                  {st === 'ERROR' && 'Lỗi'}
                </button>
              ))}
            </div>

            <button
              onClick={loadAuditLogs}
              disabled={loadingAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              Làm mới nhật ký
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Người thực hiện</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Hành động</th>
                    <th className="py-3 px-4">Đối tượng</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {auditLogs
                    .filter(log => auditFilter === 'ALL' || log.status === auditFilter)
                    .map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white">{log.userName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {log.userRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{log.action}</td>
                        <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">{log.target}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : log.status === 'WARNING'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-500 max-w-xs truncate" title={log.details || ''}>
                          {log.details || '—'}
                        </td>
                      </tr>
                    ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        Chưa có bản ghi nhật ký hoạt động nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Backup & Restore */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Download Backup */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Tải về Bản sao lưu Hệ thống
                  </h3>
                  <p className="text-xs text-slate-500">
                    Xuất toàn bộ cấu hình thiết bị, hồ sơ nhân sự, ảnh Face ID, lịch sử chấm công ra file JSON an toàn.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Phiên bản sao lưu:</span>
                  <span className="font-bold text-emerald-600">v3.0.0 (Enterprise)</span>
                </div>
                <div className="flex justify-between">
                  <span>Định dạng file:</span>
                  <span className="font-mono">hachihi_backup_YYYY-MM-DD.json</span>
                </div>
                <div className="flex justify-between">
                  <span>Khả năng khôi phục:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">100% nguyên trạng hệ thống</span>
                </div>
              </div>

              <a
                href="/api/system/backup"
                download
                className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition"
              >
                <Download className="w-4 h-4" />
                Tải xuống bản sao lưu (.json)
              </a>
            </div>

            {/* Restore Backup */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Khôi phục Dữ liệu từ File JSON
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nạp lại toàn bộ cấu hình, hồ sơ nhân sự và chấm công từ file sao lưu trước đó.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chọn file sao lưu (.json) từ máy tính:
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const content = ev.target?.result as string;
                        setRestoreJson(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              {restoreJson && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Đã đọc file JSON ({Math.round(restoreJson.length / 1024)} KB). Khi nhấn "Tiến hành khôi phục", dữ liệu hiện tại sẽ được cập nhật đồng bộ với bản sao lưu.
                  </span>
                </div>
              )}

              <button
                disabled={!restoreJson || isRestoring || !isSuperAdmin}
                onClick={async () => {
                  if (!isSuperAdmin) {
                    showToast('Chỉ Super Admin mới có quyền thực hiện khôi phục hệ thống', 'error');
                    return;
                  }
                  if (!confirm('Bạn có chắc chắn muốn khôi phục hệ thống từ file này? Dữ liệu hiện tại sẽ được ghi đè.')) {
                    return;
                  }
                  setIsRestoring(true);
                  try {
                    const parsed = JSON.parse(restoreJson);
                    const res = await HachihiDataService.restoreSystemBackup(parsed);
                    if (res.ok) {
                      showToast(res.message || 'Khôi phục hệ thống thành công!', 'success');
                      setRestoreJson('');
                    } else {
                      showToast(res.error || 'Lỗi khi khôi phục dữ liệu', 'error');
                    }
                  } catch (e: any) {
                    showToast('File JSON không hợp lệ: ' + e.message, 'error');
                  } finally {
                    setIsRestoring(false);
                  }
                }}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-amber-600/20 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                Tiến hành Khôi phục Hệ thống
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản người dùng'}
                  </h3>
                  <p className="text-xs text-slate-500">Phân quyền truy cập hệ thống</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={e => setFormFullName(e.target.value)}
                  placeholder="Ví dụ: Hoàng Văn Tuấn"
                  className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="tuan_hv"
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu truy cập
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="tuan.hoang@congty.vn"
                  className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vai trò người dùng (Role) *
                </label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as RoleType)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  <option value="CUSTOM">Tùy biến quyền riêng biệt (Custom)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {roles.find(r => r.id === formRole)?.description || 'Tự do gán các quyền cụ thể'}
                </p>
              </div>

              {/* Custom Permissions Checklist if role is CUSTOM */}
              {formRole === 'CUSTOM' && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Chọn các quyền cụ thể:
                  </p>
                  {PERMISSION_LIST.map(p => (
                    <label key={p.key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formCustomPerms.includes(p.key)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormCustomPerms([...formCustomPerms, p.key]);
                          } else {
                            setFormCustomPerms(formCustomPerms.filter(k => k !== p.key));
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md transition"
                >
                  <Check className="w-4 h-4" />
                  {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
