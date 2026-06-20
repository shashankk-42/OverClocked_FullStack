'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { AlertTriangle, ClipboardList, HeartPulse, LayoutDashboard, Search, Stethoscope } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/doctor/dashboard', label: 'My Queue', icon: LayoutDashboard },
  { href: '/doctor/search', label: 'Patient Search', icon: Search },
  { href: '/doctor/prescriptions', label: 'Prescriptions', icon: ClipboardList },
  { href: '/doctor/emergencies', label: 'Emergencies', icon: AlertTriangle },
  { href: '/doctor/follow-ups', label: 'Follow-Ups', icon: HeartPulse },
  { href: '/doctor/care-teams', label: 'Care Teams', icon: Stethoscope },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'doctor' && user.role !== 'admin') router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar items={NAV_ITEMS} role="doctor" />
      <main className="ml-64 flex-1 p-8 animate-fadeIn">{children}</main>
    </div>
  );
}
