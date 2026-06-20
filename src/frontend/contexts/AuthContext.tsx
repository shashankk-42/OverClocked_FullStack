'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/lib/api';

export interface AuthUser {
  user_id: string;
  role: 'patient' | 'doctor' | 'receptionist' | 'pharmacist' | 'admin';
  email?: string;
  phone?: string;
  name?: string;
  pid?: string;
  linked_id?: string;
  department?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, userData: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('mediflow_token');
      if (token) {
        try {
          const res = await authApi.me();
          setUser(res.data);
        } catch {
          localStorage.removeItem('mediflow_token');
          localStorage.removeItem('mediflow_user');
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = (token: string, userData: AuthUser) => {
    localStorage.setItem('mediflow_token', token);
    localStorage.setItem('mediflow_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('mediflow_token');
    localStorage.removeItem('mediflow_user');
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
