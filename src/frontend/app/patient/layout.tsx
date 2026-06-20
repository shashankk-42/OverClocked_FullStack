'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { AlertTriangle, Bed, ClipboardList, CreditCard, FileText, HeartPulse, LayoutDashboard, Calendar, History, Map, MessageSquare, Pill, ShieldCheck, Siren, User, Users } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patient/emergency', label: 'Emergency', icon: Siren },
  { href: '/patient/map', label: 'Hospital Map', icon: Map },
  { href: '/patient/book', label: 'Book Appointment', icon: Calendar },
  { href: '/patient/billing', label: 'Billing', icon: CreditCard },
  { href: '/patient/prescriptions', label: 'Prescriptions', icon: ClipboardList },
  { href: '/patient/history', label: 'Medical History', icon: History },
  { href: '/patient/medications', label: 'Medications', icon: Pill },
  { href: '/patient/reports', label: 'Test Results', icon: FileText },
  { href: '/patient/family', label: 'Family Access', icon: Users },
  { href: '/patient/insurance', label: 'Insurance', icon: ShieldCheck },
  { href: '/patient/rooms', label: 'Rooms', icon: Bed },
  { href: '/patient/journey', label: 'Care Journey', icon: HeartPulse },
  { href: '/patient/visual-triage', label: 'Visual Triage', icon: AlertTriangle },
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar items={NAV_ITEMS} role="patient" />
      <main className="flex-1 p-4 pt-20 animate-fadeIn md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
