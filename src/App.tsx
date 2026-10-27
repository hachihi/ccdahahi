import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { EmployeesView } from './components/EmployeesView';
import { AttendanceLogsView } from './components/AttendanceLogsView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { DeviceManagementView } from './components/DeviceManagementView';
import { UserManagementView } from './components/UserManagementView';
import { DocumentationView } from './components/DocumentationView';
import { Toast, ToastMessage } from './components/Toast';
import { DahahiDataService, DEFAULT_SETTINGS } from './services/dahahiService';
import { DahahiMachine, Employee, AttendanceLog, ConnectionSettings } from './types/dahahi';
import { Layers, ShieldCheck, Heart, ExternalLink, HardDrive } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [machines, setMachines] = useState<DahahiMachine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [settings, setSettings] = useState<ConnectionSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
        DahahiDataService.getMachines(),
        DahahiDataService.getEmployees(),
        DahahiDataService.getLogs(),
        DahahiDataService.getSettings()
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Sticky Header with Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        machineCount={machines.length}
        employeeCount={employees.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

        {activeTab === 'employees' && (
          <EmployeesView
            employees={employees}
            machines={machines}
            settings={settings}
            onRefreshData={refreshData}
            showToast={showToast}
          />
        )}

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

        {activeTab === 'report' && (
          <MonthlyReportView
            logs={logs}
            employees={employees}
            settings={settings}
            showToast={showToast}
          />
        )}

        {activeTab === 'devices' && (
          <DeviceManagementView
            machines={machines}
            settings={settings}
            onRefreshData={refreshData}
            showToast={showToast}
          />
        )}

        {activeTab === 'users' && (
          <UserManagementView
            showToast={showToast}
          />
        )}

        {activeTab === 'docs' && (
          <DocumentationView
            showToast={showToast}
          />
        )}
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur py-5 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Dahahi Face AI Attendance System
            </span>
            <span>• Phiên bản API v2.0.0</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('docs')}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              Tài liệu nhà sản xuất
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('devices')}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              Cấu hình thiết bị
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('users')}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              Phân quyền người dùng
            </button>
          </div>
        </div>
      </footer>

      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
