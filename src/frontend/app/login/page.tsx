'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react';

const ROLE_ROUTES: Record<string, string> = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  nurse: '/nurse/dashboard',
  receptionist: '/reception/dashboard',
  pharmacist: '/pharmacy/dashboard',
  admin: '/admin/dashboard',
};

const DEMO_PRESETS = [
  { label: 'Patient', id: '9876543210', pw: 'demo1234' },
  { label: 'Doctor', id: 'dr.sharma@mediflow.ai', pw: 'demo1234' },
  { label: 'Nurse', id: 'nurse@mediflow.ai', pw: 'demo1234' },
  { label: 'Reception', id: 'reception@mediflow.ai', pw: 'demo1234' },
  { label: 'Pharmacy', id: 'pharmacist@mediflow.ai', pw: 'demo1234' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const performLogin = async (id: string, pw: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(id, pw);
      const { access_token, role, user_id, linked_id } = res.data;
      let userData = { user_id, role, linked_id };
      try {
        const meRes = await authApi.me();
        userData = { ...userData, ...meRes.data };
      } catch {}
      login(access_token, userData as any);
      router.push(ROLE_ROUTES[role] || '/patient/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(identifier, password);
  };

  const quickLogin = (preset: { id: string; pw: string }) => {
    setIdentifier(preset.id);
    setPassword(preset.pw);
    performLogin(preset.id, preset.pw);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-neutral-900">MediFlow AI</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Welcome back</h1>
          <p className="text-neutral-500 text-sm mb-6">Sign in to your account to continue</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Email or Phone
              </label>
              <input
                id="login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or 9876543210"
                className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-700 disabled:opacity-60 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Login */}
          <div className="mt-6 pt-5 border-t border-neutral-100">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest text-center mb-3">Quick Demo Login</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => quickLogin(preset)}
                  disabled={loading}
                  className="px-3 py-2 text-xs font-medium bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-700 transition-colors disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-neutral-500 mt-5">
            New patient?{' '}
            <Link href="/register" className="text-neutral-900 font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
