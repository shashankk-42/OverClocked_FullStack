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
  receptionist: '/reception/dashboard',
  pharmacist: '/pharmacy/dashboard',
  admin: '/admin/dashboard',
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(identifier, password);
      const { access_token, role, user_id, linked_id } = res.data;

      // Fetch full user profile
      let userData = { user_id, role, linked_id };
      try {
        const meRes = await authApi.me();
        userData = { ...userData, ...meRes.data };
      } catch {}

      login(access_token, userData as any);
      router.push(ROLE_ROUTES[role] || '/patient/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (preset: { id: string; pw: string }) => {
    setIdentifier(preset.id);
    setPassword(preset.pw);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">MediFlow AI</span>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-slate-700/50">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email or Phone
              </label>
              <input
                id="login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or 9876543210"
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2.5 pr-10 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center mb-3">Quick Demo Login</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Patient', id: '9876543210', pw: 'demo1234' },
                { label: 'Doctor', id: 'dr.sharma@mediflow.ai', pw: 'demo1234' },
                { label: 'Reception', id: 'reception@mediflow.ai', pw: 'demo1234' },
                { label: 'Pharmacy', id: 'pharmacist@mediflow.ai', pw: 'demo1234' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => quickLogin(preset)}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            New patient?{' '}
            <Link href="/register" className="text-blue-400 hover:text-blue-300">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
