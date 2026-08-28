import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchUserRole: (role: 'admin' | 'security_analyst' | 'auditor') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('fimguard_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch (err) {
        console.warn('Initial session check error:', err);
        localStorage.removeItem('fimguard_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login(username, password);
      localStorage.setItem('fimguard_token', res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('fimguard_token');
    setUser(null);
  };

  const switchUserRole = async (role: 'admin' | 'security_analyst' | 'auditor') => {
    const roleMap = {
      admin: { username: 'admin', pass: 'admin123' },
      security_analyst: { username: 'analyst', pass: 'analyst123' },
      auditor: { username: 'auditor', pass: 'auditor123' }
    };
    const cred = roleMap[role];
    await login(cred.username, cred.pass);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, switchUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

