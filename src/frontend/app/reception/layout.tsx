'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { LayoutDashboard, Users, ClipboardList } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/reception/dashboard', label: 'Queue Board', icon: LayoutDashboard },
  { href: '/reception/check-in', label: 'Check-In', icon: Users },
  { href: '/reception/appointments', label: 'Appointments', icon: ClipboardList },
];

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'receptionist' && user.role !== 'admin') router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar items={NAV_ITEMS} role="receptionist" />
      <main className="ml-64 flex-1 p-6 animate-fadeIn">{children}</main>
    </div>
  );
}
