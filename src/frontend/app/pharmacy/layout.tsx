'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { ClipboardList, IndianRupee, LayoutDashboard, Package, Pill } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/pharmacy/dashboard', label: 'Prescriptions', icon: LayoutDashboard },
  { href: '/pharmacy/inventory', label: 'Inventory', icon: Package },
  { href: '/pharmacy/bills', label: 'Billing', icon: ClipboardList },
  { href: '/pharmacy/cost-analysis', label: 'Cost Analysis', icon: IndianRupee },
  { href: '/pharmacy/dispensers', label: 'Dispensers', icon: Pill },
];

export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'pharmacist' && user.role !== 'admin') router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar items={NAV_ITEMS} role="pharmacist" />
      <main className="ml-64 flex-1 p-6 animate-fadeIn">{children}</main>
    </div>
  );
}
