'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { patientsApi, appointmentsApi, billingApi } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { Calendar, Clock, ChevronRight, Activity, AlertCircle, CheckCircle, CreditCard } from 'lucide-react';
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

  const { data: pendingBills = [] } = useQuery({
    queryKey: ['patient-bills'],
    queryFn: () => billingApi.myBills().then((r) => r.data),
  });

  const upcoming = appointments.filter((a: any) =>
    ['booked', 'checked_in'].includes(a.status) && new Date(a.scheduled_at) >= new Date()
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Good {getGreeting()}, {patient?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Patient'} 👋
        </h1>
        <p className="text-neutral-500 mt-1">Here's your health overview for today</p>
      </div>

      {pendingBills.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-900">
                  {pendingBills.length} consultation payment{pendingBills.length > 1 ? 's' : ''} pending
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  Total due: ₹{pendingBills.reduce((sum: number, b: any) => sum + b.total_amount, 0).toFixed(2)}
                </p>
              </div>
            </div>
            <Link
              href={`/patient/billing?bill=${pendingBills[0].id}`}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Pay Now
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PID Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm h-full">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Patient ID Card</span>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4 mb-4 flex items-center justify-center border border-neutral-200">
              {patient?.pid ? (
                <QRCodeSVG
                  value={patient.pid}
                  size={120}
                  bgColor="transparent"
                  fgColor="#0a0a0a"
                  level="H"
                />
              ) : (
                <div className="w-[120px] h-[120px] skeleton" />
              )}
            </div>

            <div className="text-center">
              <p className="text-2xl font-mono font-bold text-neutral-900 tracking-widest">
                {patient?.pid || '···'}
              </p>
              <p className="text-neutral-500 text-sm mt-1">{patient?.name || '···'}</p>
              <div className="flex justify-center gap-4 mt-3 text-xs text-neutral-400">
                <span>{patient?.gender || '—'}</span>
                <span>•</span>
                <span>{patient?.blood_group || '—'}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 text-center">Scan QR for quick hospital check-in</p>
            </div>
          </div>
        </div>

        {/* Stats + Upcoming */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Visits', value: appointments.filter((a: any) => a.status === 'completed').length, color: 'text-blue-600' },
              { label: 'Upcoming', value: upcoming.length, color: 'text-emerald-600' },
              { label: 'Prescriptions', value: '—', color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Upcoming Appointments</h2>
              <Link href="/patient/book" className="text-xs font-medium text-blue-600 hover:text-blue-500 flex items-center gap-1">
                Book New <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">No upcoming appointments</p>
                <Link href="/patient/book"
                  className="inline-block mt-3 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors">
                  Book your first appointment →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 3).map((appt: any) => (
                  <div key={appt.id} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-neutral-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{appt.doctor_name}</p>
                      <p className="text-xs text-neutral-500">{appt.department}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span className="text-xs text-neutral-500">
                          {format(new Date(appt.scheduled_at), 'dd MMM yyyy, h:mm a')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[appt.status] || ''}`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                      {appt.queue_position && (
                        <span className="text-xs text-neutral-500">Queue #{appt.queue_position}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {patient?.allergies && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Known Allergies</p>
                <p className="text-xs text-red-600 mt-0.5">{patient.allergies}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/patient/book', label: 'Book Appointment', icon: Calendar, color: 'bg-white border-neutral-200 text-neutral-900', iconBg: 'bg-neutral-100 text-neutral-600' },
            { href: '/patient/billing', label: 'Pay Bill', icon: CreditCard, color: 'bg-white border-neutral-200 text-neutral-900', iconBg: 'bg-neutral-100 text-neutral-600' },
            { href: '/patient/history', label: 'Medical History', icon: Activity, color: 'bg-white border-neutral-200 text-neutral-900', iconBg: 'bg-neutral-100 text-neutral-600' },
            { href: '/patient/chat', label: 'AI Assistant', icon: CheckCircle, color: 'bg-white border-neutral-200 text-neutral-900', iconBg: 'bg-neutral-100 text-neutral-600' },
            { href: '/patient/profile', label: 'My Profile', icon: Activity, color: 'bg-white border-neutral-200 text-neutral-900', iconBg: 'bg-neutral-100 text-neutral-600' },
          ].map(({ href, label, icon: Icon, color, iconBg }) => (
            <Link key={href} href={href}
              className={`rounded-xl p-4 border shadow-sm ${color} flex flex-col items-start gap-2 hover:bg-neutral-50 transition-colors`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{label}</span>
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
