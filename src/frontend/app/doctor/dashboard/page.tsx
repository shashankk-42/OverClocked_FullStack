'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentsApi } from '@/lib/api';
import { format } from 'date-fns';
import { Users, Clock, Stethoscope, ChevronRight, AlertTriangle, Search, FileText, Pill } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const PRIORITY_COLOR: Record<string, string> = {
  emergency: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function DoctorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: todayAppts = [], isLoading } = useQuery({
    queryKey: ['doctor-today'],
    queryFn: () => appointmentsApi.today().then((r) => r.data),
    refetchInterval: 30000, // refresh every 30s
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-today'] });
      toast.success('Status updated');
    },
  });

  const queue = todayAppts.filter((a: any) => ['checked_in', 'in_consultation'].includes(a.status));
  const upcoming = todayAppts.filter((a: any) => a.status === 'booked');
  const completed = todayAppts.filter((a: any) => a.status === 'completed');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Doctor Workspace</p>
          <h1 className="text-2xl font-bold text-white">Clinical Command Center</h1>
          <p className="text-slate-400 mt-1">{format(new Date(), 'EEEE, dd MMMM yyyy')} | {user?.email || 'Doctor'}</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'In Queue', value: queue.length, color: 'text-blue-400' },
            { label: 'Upcoming', value: upcoming.length, color: 'text-amber-400' },
            { label: 'Completed', value: completed.length, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-xl px-4 py-3 border border-slate-700/50 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { href: '/doctor/search', title: 'Find Patient', desc: 'Open a patient record by PID, name, or phone.', icon: Search },
          { href: '/doctor/prescriptions', title: 'Prescription Review', desc: 'Audit recent prescriptions sent to pharmacy.', icon: Pill },
          { href: '/doctor/dashboard', title: 'Clinical Notes', desc: 'Use AI SOAP and Rx tools from an active consultation.', icon: FileText },
        ].map(({ href, title, desc, icon: Icon }) => (
          <Link key={title} href={href} className="glass-card rounded-xl border border-slate-700/50 p-4 transition hover:border-blue-500/50">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20">
              <Icon className="h-5 w-5 text-blue-400" />
            </div>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm text-slate-400">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Active Queue */}
      <div className="glass-card rounded-2xl p-5 border border-slate-700/50">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" /> Active Queue ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-[1fr_1.2fr]">
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
              <Users className="mb-3 h-9 w-9 text-slate-500" />
              <p className="font-semibold text-white">No patients checked in yet</p>
              <p className="mt-1 text-sm text-slate-400">Reception check-ins will appear here automatically. You can still search records or review prescriptions.</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today&apos;s booked visits</p>
              <p className="mt-1 text-3xl font-bold text-white">{upcoming.length}</p>
              <p className="mt-2 text-sm text-slate-400">Booked patients remain below until reception checks them in.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((appt: any, idx: number) => (
              <div key={appt.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                ${appt.status === 'in_consultation' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                {/* Queue number */}
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-slate-300 font-bold">
                  #{appt.queue_position || idx + 1}
                </div>

                {/* Priority indicator */}
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${PRIORITY_COLOR[appt.priority] || 'bg-slate-600'}`} />

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{appt.patient_name}</p>
                    <span className="text-xs text-slate-500 font-mono">{appt.patient_pid}</span>
                  </div>
                  <p className="text-xs text-slate-400">{appt.chief_complaint || 'No complaint specified'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">{format(new Date(appt.scheduled_at), 'h:mm a')}</span>
                  </div>
                </div>

                {/* Status + Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                  {appt.status === 'checked_in' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: appt.id, status: 'in_consultation' })}
                      className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all">
                      Start
                    </button>
                  )}
                  <Link
                    href={`/doctor/consultation/${appt.id}?patientId=${appt.patient_id}&pid=${appt.patient_pid}`}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Booked Today ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map((appt: any) => (
              <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLOR[appt.priority] || 'bg-slate-500'}`} />
                <p className="text-sm text-white flex-1">{appt.patient_name}</p>
                <span className="text-xs text-slate-400 font-mono">{appt.patient_pid}</span>
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">{format(new Date(appt.scheduled_at), 'h:mm a')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
