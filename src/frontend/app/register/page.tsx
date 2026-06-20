'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { Activity, Loader2 } from 'lucide-react';

const inputClass = 'w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-sm';

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

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
        name: form.name, phone: form.phone, password: form.password,
        email: form.email || undefined, dob: form.dob || undefined,
        gender: form.gender || undefined, blood_group: form.blood_group || undefined,
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
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-neutral-900">MediFlow AI</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Create Patient Account</h1>
          <p className="text-neutral-500 text-sm mb-6">Join MediFlow AI — get your unique Patient ID</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Full Name *" id="reg-name">
              <input id="reg-name" value={form.name} onChange={set('name')} required className={inputClass} placeholder="Your full name" />
            </Field>
            <Field label="Phone Number *" id="reg-phone">
              <input id="reg-phone" value={form.phone} onChange={set('phone')} required className={inputClass} placeholder="10-digit mobile number" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Password *" id="reg-password">
                <input id="reg-password" type="password" value={form.password} onChange={set('password')} required className={inputClass} placeholder="Min 6 characters" minLength={6} />
              </Field>
              <Field label="Confirm Password *" id="reg-confirm">
                <input id="reg-confirm" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required className={inputClass} placeholder="Repeat password" />
              </Field>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">Optional Details</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date of Birth" id="reg-dob">
                  <input id="reg-dob" type="date" value={form.dob} onChange={set('dob')} className={inputClass} />
                </Field>
                <Field label="Gender" id="reg-gender">
                  <select id="reg-gender" value={form.gender} onChange={set('gender')} className={inputClass}>
                    <option value="">Select...</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Blood Group" id="reg-blood">
                  <select id="reg-blood" value={form.blood_group} onChange={set('blood_group')} className={inputClass}>
                    <option value="">Select...</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </Field>
                <Field label="Email" id="reg-email">
                  <input id="reg-email" type="email" value={form.email} onChange={set('email')} className={inputClass} placeholder="Optional" />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Known Allergies" id="reg-allergies">
                  <input id="reg-allergies" value={form.allergies} onChange={set('allergies')} className={inputClass} placeholder="e.g. Penicillin, Sulfa drugs" />
                </Field>
              </div>
            </div>

            <button id="reg-submit" type="submit" disabled={loading}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-700 disabled:opacity-60 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mt-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating account...' : 'Create Account & Get PID'}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-5">
            Already registered?{' '}
            <Link href="/login" className="text-neutral-900 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
