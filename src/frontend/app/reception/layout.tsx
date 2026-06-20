'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { AlertTriangle, Bed, ClipboardList, HeartPulse, LayoutDashboard, TimerReset, Users } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/reception/dashboard', label: 'Queue Board', icon: LayoutDashboard },
  { href: '/reception/check-in', label: 'Check-In', icon: Users },
  { href: '/reception/appointments', label: 'Appointments', icon: ClipboardList },
  { href: '/reception/emergencies', label: 'Emergencies', icon: AlertTriangle },
  { href: '/reception/rooms', label: 'Rooms & Beds', icon: Bed },
  { href: '/reception/journeys', label: 'Patient Journey', icon: HeartPulse },
  { href: '/reception/waitlist', label: 'Earlier Slots', icon: TimerReset },
];

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'receptionist' && user.role !== 'admin') router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar items={NAV_ITEMS} role="receptionist" />
      <main className="ml-64 flex-1 p-8 animate-fadeIn">{children}</main>
    </div>
  );
}
