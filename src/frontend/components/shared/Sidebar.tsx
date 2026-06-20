'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  items: NavItem[];
  role: string;
}

export function Sidebar({ items, role }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const roleColors: Record<string, string> = {
    patient: 'text-blue-400 bg-blue-500/10',
    doctor: 'text-emerald-400 bg-emerald-500/10',
    receptionist: 'text-purple-400 bg-purple-500/10',
    pharmacist: 'text-amber-400 bg-amber-500/10',
    admin: 'text-rose-400 bg-rose-500/10',
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">MediFlow AI</p>
          <p className={cn('text-xs capitalize font-medium', roleColors[role] || 'text-slate-400')}>
            {role}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn('sidebar-item', isActive && 'active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || user?.email || 'User'}</p>
            {user?.pid && <p className="text-xs text-slate-500 truncate">{user.pid}</p>}
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/5"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
