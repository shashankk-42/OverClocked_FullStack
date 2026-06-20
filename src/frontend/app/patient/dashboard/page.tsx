'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { patientsApi, appointmentsApi } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { Calendar, Clock, ChevronRight, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const PRIORITY_CLASS: Record<string, string> = {
  emergency: 'priority-emergency',
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
};

const STATUS_CLASS: Record<string, string> = {
  booked: 'status-booked',
  checked_in: 'status-checked_in',
  in_consultation: 'status-in_consultation',
  completed: 'status-completed',
  cancelled: 'status-cancelled',
};

export default function PatientDashboard() {
  const { user } = useAuth();

  const { data: patient } = useQuery({
    queryKey: ['patient-me'],
    queryFn: () => patientsApi.me().then((r) => r.data),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentsApi.myAppointments().then((r) => r.data),
  });

  const upcoming = appointments.filter((a: any) =>
    ['booked', 'checked_in'].includes(a.status) && new Date(a.scheduled_at) >= new Date()
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Good {getGreeting()}, {patient?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Patient'} 👋
        </h1>
        <p className="text-slate-400 mt-1">Here's your health overview for today</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PID Card */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 border border-blue-500/20 glow-blue h-full">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Patient ID Card</span>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 mb-4 flex items-center justify-center">
              {patient?.pid ? (
                <QRCodeSVG
                  value={patient.pid}
                  size={120}
                  bgColor="transparent"
                  fgColor="#60a5fa"
                  level="H"
                />
              ) : (
                <div className="w-[120px] h-[120px] skeleton" />
              )}
            </div>

            <div className="text-center">
              <p className="text-2xl font-mono font-bold text-white tracking-widest">
                {patient?.pid || '···'}
              </p>
              <p className="text-slate-400 text-sm mt-1">{patient?.name || '···'}</p>
              <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
                <span>{patient?.gender || '—'}</span>
                <span>•</span>
                <span>{patient?.blood_group || '—'}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center">Scan QR for quick hospital check-in</p>
            </div>
          </div>
        </div>

        {/* Stats + Upcoming */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Visits', value: appointments.filter((a: any) => a.status === 'completed').length, color: 'text-blue-400' },
              { label: 'Upcoming', value: upcoming.length, color: 'text-emerald-400' },
              { label: 'Prescriptions', value: '—', color: 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card rounded-xl p-4 border border-slate-700/50">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Upcoming Appointments */}
          <div className="glass-card rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Upcoming Appointments</h2>
              <Link href="/patient/book" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Book New <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No upcoming appointments</p>
                <Link href="/patient/book"
                  className="inline-block mt-3 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-3 py-1.5">
                  Book your first appointment →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 3).map((appt: any) => (
                  <div key={appt.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{appt.doctor_name}</p>
                      <p className="text-xs text-slate-400">{appt.department}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-400">
                          {format(new Date(appt.scheduled_at), 'dd MMM yyyy, h:mm a')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[appt.status] || ''}`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                      {appt.queue_position && (
                        <span className="text-xs text-slate-500">Queue #{appt.queue_position}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {patient?.allergies && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Known Allergies</p>
                <p className="text-xs text-red-400/80 mt-0.5">{patient.allergies}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/patient/book', label: 'Book Appointment', icon: Calendar, color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
            { href: '/patient/history', label: 'Medical History', icon: Activity, color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
            { href: '/patient/chat', label: 'AI Assistant', icon: CheckCircle, color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
            { href: '/patient/profile', label: 'My Profile', icon: Activity, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href}
              className={`glass-card rounded-xl p-4 border ${color.split(' ')[1]} flex flex-col items-start gap-2 hover:scale-[1.02] transition-transform`}>
              <div className={`w-8 h-8 rounded-lg ${color.split(' ')[0]} ${color.split(' ')[1]} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color.split(' ')[2]}`} />
              </div>
              <span className="text-sm font-medium text-white">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
