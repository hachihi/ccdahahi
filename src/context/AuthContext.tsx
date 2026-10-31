import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemUser, RoleType, PermissionKey, UserRole } from '../types/hachihi';
import { INITIAL_USERS, DEFAULT_ROLES } from '../mock/sampleData';

interface AuthContextType {
  currentUser: SystemUser;
  users: SystemUser[];
  roles: UserRole[];
  hasPermission: (perm: PermissionKey) => boolean;
  switchUser: (userId: string) => void;
  addUser: (user: Omit<SystemUser, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, updates: Partial<SystemUser>) => void;
  deleteUser: (id: string) => void;
  toggleUserStatus: (id: string) => void;
  updateRolePermissions: (roleId: RoleType, permissions: PermissionKey[]) => void;
}

const USERS_STORAGE_KEY = 'hachihi_users_v2';
const CURRENT_USER_KEY = 'hachihi_current_user_v2';
const ROLES_STORAGE_KEY = 'hachihi_roles_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<SystemUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_USERS;
  });

  const [roles, setRoles] = useState<UserRole[]>(() => {
    try {
      const saved = localStorage.getItem(ROLES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ROLES;
  });

  const [currentUser, setCurrentUser] = useState<SystemUser>(() => {
    try {
      const savedId = localStorage.getItem(CURRENT_USER_KEY);
      if (savedId) {
        const found = users.find(u => u.id === savedId);
        if (found) return found;
      }
    } catch {}
    return users[0] || INITIAL_USERS[0];
  });

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(CURRENT_USER_KEY, currentUser.id);
    }
  }, [currentUser]);

  const hasPermission = (perm: PermissionKey): boolean => {
    if (!currentUser || !currentUser.isActive) return false;
    // If user has custom permissions, prioritize
    if (currentUser.customPermissions && currentUser.customPermissions.length > 0) {
      return currentUser.customPermissions.includes(perm);
    }
    const roleObj = roles.find(r => r.id === currentUser.role);
    if (!roleObj) return false;
    return roleObj.permissions.includes(perm);
  };

  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
    }
  };

  const addUser = (userData: Omit<SystemUser, 'id' | 'createdAt'>) => {
    const newUser: SystemUser = {
      ...userData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.username)}`
    };
    setUsers(prev => [...prev, newUser]);
  };

  const updateUser = (id: string, updates: Partial<SystemUser>) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updates } : u)));
    if (currentUser.id === id) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
  };

  const deleteUser = (id: string) => {
    if (users.length <= 1) {
      throw new Error('Hệ thống phải duy trì ít nhất 1 người dùng');
    }
    if (currentUser.id === id) {
      throw new Error('Không thể tự xóa tài khoản đang đăng nhập hiện tại');
    }
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const toggleUserStatus = (id: string) => {
    if (currentUser.id === id) {
      throw new Error('Không thể vô hiệu hóa tài khoản đang đăng nhập');
    }
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, isActive: !u.isActive } : u)));
  };

  const updateRolePermissions = (roleId: RoleType, permissions: PermissionKey[]) => {
    setRoles(prev => prev.map(r => (r.id === roleId ? { ...r, permissions } : r)));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        roles,
        hasPermission,
        switchUser,
        addUser,
        updateUser,
        deleteUser,
        toggleUserStatus,
        updateRolePermissions
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
