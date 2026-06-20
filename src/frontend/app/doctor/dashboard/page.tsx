'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentsApi, billingApi } from '@/lib/api';
import { format } from 'date-fns';
import {
  Users, Clock, ChevronRight, Search, FileText, Pill,
  CalendarCheck, XCircle, History, Loader2, AlertCircle,
  Send, CreditCard,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const PRIORITY_COLOR: Record<string, string> = {
  emergency: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  emergency: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-green-50 text-green-700 border-green-200',
};

type Appointment = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_pid: string;
  scheduled_at: string;
  status: string;
  queue_position?: number | null;
  chief_complaint?: string | null;
  priority?: string;
};

function AppointmentCard({
  appt,
  idx,
  onAccept,
  onDecline,
  onStart,
  busy,
}: {
  appt: Appointment;
  idx: number;
  onAccept?: () => void;
  onDecline?: () => void;
  onStart?: () => void;
  busy?: boolean;
}) {
  const priority = appt.priority || 'medium';

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center
        ${appt.status === 'in_consultation' ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-white'}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {appt.queue_position ? (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-600">
            #{appt.queue_position}
          </div>
        ) : (
          <div className={`mt-1 h-8 w-1 flex-shrink-0 rounded-full ${PRIORITY_COLOR[priority] || 'bg-neutral-300'}`} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-neutral-900">{appt.patient_name}</p>
            <span className="font-mono text-xs text-neutral-500">{appt.patient_pid}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${PRIORITY_BADGE[priority] || PRIORITY_BADGE.medium}`}>
              {priority}
            </span>
          </div>

          <p className="mt-1 text-sm text-neutral-600">
            {appt.chief_complaint || 'No complaint specified'}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(appt.scheduled_at), 'h:mm a')}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" />
              {format(new Date(appt.scheduled_at), 'dd MMM yyyy')}
            </span>
            <span className={`rounded-full border px-2 py-0.5 capitalize status-${appt.status}`}>
              {appt.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Link
          href={`/doctor/patient/${appt.patient_pid}?patientId=${appt.patient_id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          <History className="h-3.5 w-3.5" />
          History
        </Link>

        {appt.status === 'booked' && onAccept && onDecline && (
          <>
            <button
              onClick={onAccept}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={onDecline}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Decline
            </button>
          </>
        )}

        {['checked_in', 'waiting'].includes(appt.status) && onStart && (
          <button
            onClick={onStart}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Start Consultation
          </button>
        )}

        {['checked_in', 'waiting', 'in_consultation'].includes(appt.status) && (
          <Link
            href={`/doctor/consultation/${appt.id}?patientId=${appt.patient_id}&pid=${appt.patient_pid}`}
            className="rounded-lg bg-neutral-100 p-1.5 text-neutral-600 transition hover:bg-neutral-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: todayAppts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['doctor-today'],
    queryFn: () => appointmentsApi.today().then((r) => r.data),
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-today'] });
      if (vars.status === 'checked_in') toast.success('Appointment accepted — patient added to queue');
      else if (vars.status === 'cancelled') toast.success('Appointment declined');
      else toast.success('Status updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Could not update appointment');
    },
  });

  const queue = todayAppts.filter((a: Appointment) => ['checked_in', 'waiting', 'in_consultation'].includes(a.status));
  const pending = todayAppts
    .filter((a: Appointment) => a.status === 'booked')
    .sort((a: Appointment, b: Appointment) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const completed = todayAppts.filter((a: Appointment) => a.status === 'completed');
  const nextPending = pending[0];
  const busy = updateStatusMutation.isPending;

  const sendPaymentLinkMutation = useMutation({
    mutationFn: (appointmentId: string) => billingApi.sendPaymentLink(appointmentId),
    onSuccess: () => toast.success('Payment link sent to patient dashboard'),
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not send payment link'),
  });

  const { data: completedBillMap = {} } = useQuery({
    queryKey: ['doctor-completed-bills', completed.map((a: Appointment) => a.id)],
    queryFn: async () => {
      const entries = await Promise.all(
        completed.map(async (appt: Appointment) => {
          try {
            const res = await billingApi.getAppointmentBill(appt.id);
            return [appt.id, res.data.bill] as const;
          } catch {
            return [appt.id, null] as const;
          }
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: completed.length > 0,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Doctor Workspace</p>
          <h1 className="text-2xl font-bold text-neutral-900">Clinical Command Center</h1>
          <p className="mt-1 text-neutral-500">
            {format(new Date(), 'EEEE, dd MMMM yyyy')} | {user?.name || user?.email || 'Doctor'}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Pending', value: pending.length, color: 'text-amber-600' },
            { label: 'In Queue', value: queue.length, color: 'text-blue-600' },
            { label: 'Completed', value: completed.length, color: 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-neutral-500">{label}</p>
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
          <Link key={title} href={href} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-blue-300">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <p className="font-semibold text-neutral-900">{title}</p>
            <p className="mt-1 text-sm text-neutral-500">{desc}</p>
          </Link>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-white p-10">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          Could not load today&apos;s appointments.
          <button onClick={() => refetch()} className="ml-auto font-medium underline">Retry</button>
        </div>
      )}

      {!isLoading && !isError && nextPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-800">
            <CalendarCheck className="h-4 w-4" /> Next Appointment — Awaiting Your Response
          </h2>
          <AppointmentCard
            appt={nextPending}
            idx={0}
            busy={busy}
            onAccept={() => updateStatusMutation.mutate({ id: nextPending.id, status: 'checked_in' })}
            onDecline={() => updateStatusMutation.mutate({ id: nextPending.id, status: 'cancelled' })}
          />
        </div>
      )}

      {/* Pending / booked appointments */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-900">
          <CalendarCheck className="h-4 w-4 text-amber-600" /> Pending Appointments ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-500">No new bookings for today. Accepted patients appear in the active queue below.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((appt: Appointment, idx: number) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                idx={idx}
                busy={busy}
                onAccept={() => updateStatusMutation.mutate({ id: appt.id, status: 'checked_in' })}
                onDecline={() => updateStatusMutation.mutate({ id: appt.id, status: 'cancelled' })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active Queue */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-900">
          <Users className="h-4 w-4 text-blue-600" /> Active Queue ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <Users className="mb-3 h-9 w-9 text-neutral-400" />
            <p className="font-semibold text-neutral-900">No patients in queue</p>
            <p className="mt-1 text-sm text-neutral-500">
              Accept a pending appointment above to add them here, or wait for reception to check them in.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((appt: Appointment, idx: number) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                idx={idx}
                busy={busy}
                onStart={() => updateStatusMutation.mutate({ id: appt.id, status: 'in_consultation' })}
              />
            ))}
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Completed Today ({completed.length})
          </h2>
          <div className="space-y-2">
            {completed.map((appt: Appointment) => {
              const bill = (completedBillMap as Record<string, any>)[appt.id];
              return (
              <div key={appt.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm text-neutral-900">{appt.patient_name}</p>
                <span className="font-mono text-xs text-neutral-500">{appt.patient_pid}</span>
                <span className="text-xs text-neutral-500">{format(new Date(appt.scheduled_at), 'h:mm a')}</span>
                {bill && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                    bill.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {bill.payment_status === 'paid' ? 'Paid' : `Due ₹${bill.total_amount}`}
                  </span>
                )}
                <Link
                  href={`/doctor/patient/${appt.patient_pid}?patientId=${appt.patient_id}`}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  History
                </Link>
                {bill?.payment_status === 'pending' && (
                  <button
                    onClick={() => sendPaymentLinkMutation.mutate(appt.id)}
                    disabled={sendPaymentLinkMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Payment Link
                  </button>
                )}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}
