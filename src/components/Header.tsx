import React, { useState } from 'react';
import {
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Users,
  HardDrive,
  FileText,
  Calendar,
  Layers,
  Activity,
  BookOpen,
  Wifi,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ConnectionSettings } from '../types/dahahi';

export type ActiveTab = 'dashboard' | 'employees' | 'logs' | 'report' | 'devices' | 'users' | 'docs';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: ConnectionSettings;
  machineCount: number;
  employeeCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  machineCount,
  employeeCount
}) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, users, switchUser, roles } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const currentRoleObj = roles.find(r => r.id === currentUser.role);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Bảng điều khiển', icon: <Activity className="w-4 h-4" /> },
    { id: 'employees', label: 'Nhân viên & Gương mặt', icon: <Users className="w-4 h-4" />, badge: employeeCount },
    { id: 'logs', label: 'Lịch sử chấm công', icon: <Calendar className="w-4 h-4" /> },
    { id: 'report', label: 'Bảng công tháng', icon: <FileText className="w-4 h-4" /> },
    { id: 'devices', label: 'Kết nối máy', icon: <HardDrive className="w-4 h-4" />, badge: machineCount },
    { id: 'users', label: 'Phân quyền User', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'docs', label: 'Tài liệu NSX (API v2.0)', icon: <BookOpen className="w-4 h-4" /> }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                  DAHAHI
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  Face AI v2.0
                </span>
                {machineCount > 0 ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Đã kết nối {machineCount} máy
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Chưa kết nối máy
                  </span>
                )}
                {settings.autoSync?.enabled ? (
                  <button
                    onClick={() => setActiveTab('devices')}
                    className="hidden md:inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300 dark:border-teal-800 hover:opacity-85 transition"
                    title="Nhấp để cấu hình chu kỳ tự động đồng bộ"
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                    Tự đồng bộ: {settings.autoSync.intervalMinutes}p/lần
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('devices')}
                    className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900 transition"
                  >
                    Tự đồng bộ: Tắt
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Hệ thống Quản lý Chấm công & Tải Khuôn mặt Dahahi
              </p>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* User Dropdown & Fast Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition"
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

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 text-sm animate-in fade-in duration-150">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        Tài khoản hiện tại
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                        {currentUser.fullName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {currentUser.email}
                      </p>
                      <div className="mt-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${currentRoleObj?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                          {currentRoleObj?.name || currentUser.role}
                        </span>
                      </div>
                    </div>

                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase px-2 py-1 tracking-wider">
                        Chuyển nhanh người dùng
                      </p>
                      <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                        {users.map(u => {
                          const isSel = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              onClick={() => {
                                switchUser(u.id);
                                setShowUserMenu(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition ${
                                isSel
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <img
                                src={u.avatar}
                                alt={u.fullName}
                                className="w-6 h-6 rounded-md object-cover"
                              />
                              <div className="flex-1 truncate">
                                <p className="text-xs leading-none truncate">{u.fullName}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{u.role}</p>
                              </div>
                              {isSel && (
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setActiveTab('users');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Quản trị & Phân quyền tài khoản
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 overflow-x-auto pb-1.5 scrollbar-none border-t border-slate-100 dark:border-slate-800/80 pt-1">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
