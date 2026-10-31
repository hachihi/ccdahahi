import React, { useState } from 'react';
import {
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Users,
  HardDrive,
  Calendar,
  Layers,
  Activity,
  BookOpen,
  Wifi,
  Sparkles,
  Menu,
  FileSpreadsheet,
  Clock,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ConnectionSettings, ActiveTab } from '../types/hachihi';

export type { ActiveTab };


interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: ConnectionSettings;
  machineCount: number;
  employeeCount: number;
  onOpenMobileMenu?: () => void;
  onRefreshData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  machineCount,
  employeeCount,
  onOpenMobileMenu,
  onRefreshData
}) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, users, switchUser, roles } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const currentRoleObj = roles.find(r => r.id === currentUser.role);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Mobile Drawer Trigger & Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu */}
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand on mobile (when sidebar is hidden) */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              HACHIHI 3.0
            </span>
          </div>

          {/* Quick status pills */}
          <div className="hidden sm:flex items-center gap-2">
            {machineCount > 0 ? (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đã kết nối {machineCount} máy ({settings.serial || '1605055'})
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Chưa kết nối máy
              </span>
            )}

            {settings.autoSync?.enabled ? (
              <button
                onClick={() => setActiveTab('devices')}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300 dark:border-teal-800 hover:opacity-85 transition"
                title="Tự động đồng bộ lịch sử chấm công và kiểm tra máy"
              >
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                Tự đồng bộ: {settings.autoSync.intervalMinutes}p/lần
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('devices')}
                className="hidden lg:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900 transition"
              >
                Tự đồng bộ: Tắt
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Refresh Button */}
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Làm mới toàn bộ dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* User Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.fullName}
                className="w-7 h-7 rounded-lg object-cover ring-2 ring-emerald-500/30"
              />
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {currentRoleObj?.name.split('(')[0].trim() || currentUser.role}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in duration-150"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentUser.fullName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {currentRoleObj?.name || currentUser.role}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Chuyển nhanh tài khoản kiểm thử
                  </div>
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setShowUserMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                        u.id === currentUser.id
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img src={u.avatar} alt={u.fullName} className="w-6 h-6 rounded-lg object-cover" />
                        <div className="text-left">
                          <div className="leading-tight">{u.fullName}</div>
                          <div className="text-[10px] text-slate-400">{u.role}</div>
                        </div>
                      </div>
                      {u.id === currentUser.id && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setActiveTab('users');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Quản lý người dùng & Phân quyền
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
