import React from 'react';
import {
  Activity,
  Users,
  HardDrive,
  Calendar,
  FileSpreadsheet,
  Clock,
  SlidersHorizontal,
  ShieldCheck,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  Wifi,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConnectionSettings, ActiveTab } from '../types/hachihi';

export type { ActiveTab };


interface EnterpriseSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  machineCount: number;
  employeeCount: number;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  settings: ConnectionSettings;
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  activeTab,
  setActiveTab,
  machineCount,
  employeeCount,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  settings
}) => {
  const { currentUser, roles } = useAuth();
  const currentRoleObj = roles.find(r => r.id === currentUser.role);

  const navItems: { id: ActiveTab; label: string; numberLabel: string; icon: React.ReactNode; badge?: number | string }[] = [
    { id: 'dashboard', label: '1. Tổng quan', numberLabel: '1', icon: <Activity className="w-5 h-5 shrink-0" /> },
    { id: 'employees', label: '2. Quản lý nhân viên', numberLabel: '2', icon: <Users className="w-5 h-5 shrink-0" />, badge: employeeCount },
    { id: 'devices', label: '3. Kết nối thiết bị', numberLabel: '3', icon: <HardDrive className="w-5 h-5 shrink-0" />, badge: machineCount },
    { id: 'logs', label: '4. Dữ liệu chấm công', numberLabel: '4', icon: <Calendar className="w-5 h-5 shrink-0" /> },
    { id: 'report', label: '5. Báo cáo chấm công', numberLabel: '5', icon: <FileSpreadsheet className="w-5 h-5 shrink-0" /> },
    { id: 'shifts', label: '6. Cấu hình tính công', numberLabel: '6', icon: <Clock className="w-5 h-5 shrink-0" /> },
    { id: 'templates', label: '7. Mẫu bảng công', numberLabel: '7', icon: <SlidersHorizontal className="w-5 h-5 shrink-0" /> },
    { id: 'users', label: '8. Quản trị hệ thống', numberLabel: '8', icon: <ShieldCheck className="w-5 h-5 shrink-0" /> },
    { id: 'docs', label: '9. Hướng dẫn sử dụng', numberLabel: '9', icon: <BookOpen className="w-5 h-5 shrink-0" /> }
  ];

  const handleNavClick = (id: ActiveTab) => {
    setActiveTab(id);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in"
        />
      )}

      {/* Main Sidebar Component */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen md:h-dvh bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col justify-between ${
          /* Mobile Drawer */
          isMobileOpen
            ? 'translate-x-0 w-72 shadow-2xl'
            : '-translate-x-full md:translate-x-0'
        } ${
          /* Desktop Widths */
          isCollapsed ? 'md:w-[72px]' : 'md:w-64'
        } desktop-sidebar`}
      >
        {/* Top Brand Logo */}
        <div>
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base">
                      HACHIHI
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                      3.0
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate font-medium">
                    Face AI & Workforce
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle Button */}
            <button
              onClick={() => setIsCollapsed(prev => !prev)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items (9 Core Modules) */}
          <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all group relative ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500 transition-colors'}`}>
                    {item.icon}
                  </span>

                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">
                      {item.label}
                    </span>
                  )}

                  {!isCollapsed && item.badge !== undefined && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip in collapsed state */}
                  {isCollapsed && (
                    <div className="hidden group-hover:block absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-xl z-50 pointer-events-none">
                      {item.label}
                      {item.badge !== undefined && ` (${item.badge})`}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Machine & User Card */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Máy:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {machineCount > 0 ? `${machineCount} trực tuyến` : '0 máy'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.fullName}
                  className="w-7 h-7 rounded-lg object-cover ring-1 ring-emerald-500/40 shrink-0"
                />
                <div className="truncate flex-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentRoleObj?.name.split('(')[0].trim() || currentUser.role}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <img
                src={currentUser.avatar}
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-xl object-cover ring-2 ring-emerald-500/40"
                title={`${currentUser.fullName} (${currentUser.role})`}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
