'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { LayoutDashboard, Calendar, History, MessageSquare, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patient/book', label: 'Book Appointment', icon: Calendar },
  { href: '/patient/history', label: 'Medical History', icon: History },
  { href: '/patient/chat', label: 'AI Assistant', icon: MessageSquare },
  { href: '/patient/profile', label: 'My Profile', icon: User },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'patient') router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar items={NAV_ITEMS} role="patient" />
      <main className="ml-64 flex-1 p-6 animate-fadeIn">{children}</main>
    </div>
  );
}
