'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { Activity, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', password: '', confirmPassword: '',
    email: '', dob: '', gender: '', blood_group: '', allergies: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        name: form.name,
        phone: form.phone,
        password: form.password,
        email: form.email || undefined,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        blood_group: form.blood_group || undefined,
        allergies: form.allergies || undefined,
      });

      const { access_token, role, user_id, linked_id, pid, name } = res.data;
      login(access_token, { user_id, role, linked_id, name, pid } as any);
      router.push('/patient/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">MediFlow AI</span>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-slate-700/50">
          <h1 className="text-2xl font-bold text-white mb-1">Create Patient Account</h1>
          <p className="text-slate-400 text-sm mb-6">Join MediFlow AI — get your unique Patient ID</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Required fields */}
              <Field label="Full Name *" id="reg-name">
                <input id="reg-name" value={form.name} onChange={set('name')} required
                  className="input-field" placeholder="Your full name" />
              </Field>
              <Field label="Phone Number *" id="reg-phone">
                <input id="reg-phone" value={form.phone} onChange={set('phone')} required
                  className="input-field" placeholder="10-digit mobile number" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password *" id="reg-password">
                  <input id="reg-password" type="password" value={form.password} onChange={set('password')} required
                    className="input-field" placeholder="Min 8 characters" minLength={6} />
                </Field>
                <Field label="Confirm Password *" id="reg-confirm">
                  <input id="reg-confirm" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required
                    className="input-field" placeholder="Repeat password" />
                </Field>
              </div>

              {/* Optional fields */}
              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Optional Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth" id="reg-dob">
                    <input id="reg-dob" type="date" value={form.dob} onChange={set('dob')} className="input-field" />
                  </Field>
                  <Field label="Gender" id="reg-gender">
                    <select id="reg-gender" value={form.gender} onChange={set('gender')} className="input-field">
                      <option value="">Select...</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Field>
                  <Field label="Blood Group" id="reg-blood">
                    <select id="reg-blood" value={form.blood_group} onChange={set('blood_group')} className="input-field">
                      <option value="">Select...</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                        <option key={bg}>{bg}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Email" id="reg-email">
                    <input id="reg-email" type="email" value={form.email} onChange={set('email')} className="input-field" placeholder="Optional" />
                  </Field>
                </div>
                <Field label="Known Allergies" id="reg-allergies">
                  <input id="reg-allergies" value={form.allergies} onChange={set('allergies')} className="input-field" placeholder="e.g. Penicillin, Sulfa drugs" />
                </Field>
              </div>
            </div>

            <button id="reg-submit" type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 mt-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating account...' : 'Create Account & Get PID'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already registered?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.625rem 0.75rem;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgb(51, 65, 85);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus { border-color: rgb(59, 130, 246); }
        .input-field::placeholder { color: rgb(100, 116, 139); }
      `}</style>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
