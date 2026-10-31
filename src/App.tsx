import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { EnterpriseSidebar } from './components/EnterpriseSidebar';
import { DashboardView } from './components/DashboardView';
import { EmployeesView } from './components/EmployeesView';
import { AttendanceLogsView } from './components/AttendanceLogsView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { DeviceManagementView } from './components/DeviceManagementView';
import { ShiftConfigView } from './components/ShiftConfigView';
import { TimesheetTemplatesView } from './components/TimesheetTemplatesView';
import { UserManagementView } from './components/UserManagementView';
import { DocumentationView } from './components/DocumentationView';
import { Toast, ToastMessage } from './components/Toast';
import { HachihiDataService, DEFAULT_SETTINGS } from './services/hachihiService';
import { HachihiMachine, Employee, AttendanceLog, ConnectionSettings, ActiveTab } from './types/hachihi';

import { Layers, ShieldCheck, Heart, ExternalLink, HardDrive } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [machines, setMachines] = useState<HachihiMachine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [settings, setSettings] = useState<ConnectionSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Responsive sidebar collapse state:
  // >= 1440px: expanded
  // 1024 - 1439px: collapsed
  // < 1024px: mobile slide-over drawer
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1440 && window.innerWidth >= 768;
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1440) {
        setIsCollapsed(false);
      } else if (window.innerWidth >= 1024) {
        setIsCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show Toast notification
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Reload real data from server API
  const refreshData = useCallback(async () => {
    try {
      const [fetchedMachines, fetchedEmployees, fetchedLogs, fetchedSettings] = await Promise.all([
        HachihiDataService.getMachines(),
        HachihiDataService.getEmployees(),
        HachihiDataService.getLogs(),
        HachihiDataService.getSettings()
      ]);
      setMachines(fetchedMachines);
      setEmployees(fetchedEmployees);
      setLogs(fetchedLogs);
      setSettings(fetchedSettings);
    } catch (err: any) {
      console.warn('Error refreshing data from server:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
    // Auto-refresh state from server every 30s so UI updates when background auto-sync runs
    const interval = setInterval(() => {
      refreshData();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <div className="app-shell bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-row min-h-screen transition-colors duration-200">
      {/* 1. Left Enterprise Responsive Sidebar */}
      <EnterpriseSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        machineCount={machines.length}
        employeeCount={employees.length}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        settings={settings}
      />

      {/* 2. Main Right Column */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Sticky Header Topbar with actions */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
          machineCount={machines.length}
          employeeCount={employees.length}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onRefreshData={refreshData}
        />

        {/* Dynamic Full-Width Main Content View (Zero hardcoded max-w constraint) */}
        <main className="app-main">
          {/* Module 1: Tổng quan */}
          {activeTab === 'dashboard' && (
            <DashboardView
              machines={machines}
              employees={employees}
              logs={logs}
              settings={settings}
              setActiveTab={setActiveTab}
              onRefreshData={refreshData}
              showToast={showToast}
            />
          )}

          {/* Module 2: Quản lý nhân viên */}
          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              machines={machines}
              settings={settings}
              onRefreshData={refreshData}
              showToast={showToast}
            />
          )}

          {/* Module 3: Kết nối thiết bị */}
          {activeTab === 'devices' && (
            <DeviceManagementView
              machines={machines}
              settings={settings}
              onRefreshData={refreshData}
              showToast={showToast}
            />
          )}

          {/* Module 4: Dữ liệu chấm công */}
          {activeTab === 'logs' && (
            <AttendanceLogsView
              logs={logs}
              machines={machines}
              employees={employees}
              settings={settings}
              onRefreshData={refreshData}
              showToast={showToast}
            />
          )}

          {/* Module 5: Báo cáo chấm công */}
          {activeTab === 'report' && (
            <MonthlyReportView
              logs={logs}
              employees={employees}
              machines={machines}
              settings={settings}
              showToast={showToast}
            />
          )}

          {/* Module 6: Cấu hình tính công */}
          {activeTab === 'shifts' && (
            <ShiftConfigView
              employees={employees}
              showToast={showToast}
            />
          )}

          {/* Module 7: Mẫu bảng công */}
          {activeTab === 'templates' && (
            <TimesheetTemplatesView
              showToast={showToast}
            />
          )}

          {/* Module 8: Quản trị hệ thống & Phân quyền */}
          {activeTab === 'users' && (
            <UserManagementView
              showToast={showToast}
            />
          )}

          {/* Module 9: Hướng dẫn sử dụng & Tài liệu API */}
          {activeTab === 'docs' && (
            <DocumentationView
              showToast={showToast}
            />
          )}
        </main>

        {/* Global Responsive Footer */}
        <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur py-4 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                HACHIHI CHẤM CÔNG 3.0
              </span>
              <span>• Face AI & Workforce Management</span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => setActiveTab('docs')}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
              >
                Tài liệu Hachihi SDK
              </button>
              <span>•</span>
              <button
                onClick={() => setActiveTab('devices')}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
              >
                Cấu hình máy
              </button>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Build: Enterprise Ready
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};


export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
