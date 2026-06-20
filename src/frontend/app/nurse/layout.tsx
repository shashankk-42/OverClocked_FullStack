'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { Activity, AlertTriangle, Bed, ClipboardList, HeartPulse, Pill } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/nurse/dashboard', label: 'Dashboard', icon: Activity },
  { href: '/nurse/dashboard#vitals', label: 'Vitals', icon: HeartPulse },
  { href: '/nurse/dashboard#medications', label: 'Medications', icon: Pill },
  { href: '/nurse/dashboard#beds', label: 'Beds', icon: Bed },
  { href: '/nurse/dashboard#notes', label: 'Notes', icon: ClipboardList },
  { href: '/nurse/dashboard#emergencies', label: 'Emergencies', icon: AlertTriangle },
];

export default function NurseLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'nurse' && user.role !== 'admin') router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar items={NAV_ITEMS} role="nurse" />
      <main className="flex-1 p-4 pt-20 animate-fadeIn md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
