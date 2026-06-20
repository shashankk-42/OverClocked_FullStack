'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, patientsApi } from '@/lib/api';
import { format } from 'date-fns';
import {
  Search, QrCode, CheckCircle, Users, Clock, Loader2,
  CalendarCheck, XCircle, AlertCircle,
} from 'lucide-react';
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
  patient_name: string;
  patient_pid: string;
  doctor_name: string;
  scheduled_at: string;
  status: string;
  queue_position?: number | null;
  chief_complaint?: string | null;
  priority?: string;
};

function PendingCard({
  appt,
  onApprove,
  onDeny,
  busy,
}: {
  appt: Appointment;
  onApprove: () => void;
  onDeny: () => void;
  busy?: boolean;
}) {
  const priority = appt.priority || 'medium';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className={`mt-1 h-8 w-1 flex-shrink-0 rounded-full ${PRIORITY_COLOR[priority] || 'bg-neutral-300'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-neutral-900">{appt.patient_name}</p>
            <span className="font-mono text-xs text-neutral-500">{appt.patient_pid}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${PRIORITY_BADGE[priority] || PRIORITY_BADGE.medium}`}>
              {priority}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">{appt.chief_complaint || 'No complaint specified'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(appt.scheduled_at), 'h:mm a')}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" />
              {format(new Date(appt.scheduled_at), 'dd MMM yyyy')}
            </span>
            <span>{appt.doctor_name}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <button
          onClick={onApprove}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={onDeny}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Deny
        </button>
      </div>
    </div>
  );
}

export default function ReceptionDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reception-today'] });
    queryClient.invalidateQueries({ queryKey: ['reception-pending'] });
  };

  const { data: todayAppts = [], isLoading } = useQuery({
    queryKey: ['reception-today'],
    queryFn: () => appointmentsApi.today().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: pendingAppts = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['reception-pending'],
    queryFn: () => appointmentsApi.pendingApproval().then((r) => r.data),
    refetchInterval: 15000,
  });

  const checkInMutation = useMutation({
    mutationFn: (appointmentId: string) => appointmentsApi.checkIn(appointmentId),
    onSuccess: (data) => {
      toast.success(`Checked in! Queue position: #${data.data.queue_position}`);
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Check-in failed'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: (_data, vars) => {
      invalidateAll();
      if (vars.status === 'checked_in') toast.success('Appointment approved — doctor and patient notified');
      else if (vars.status === 'cancelled') toast.success('Appointment denied — patient notified');
      else toast.success('Status updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not update appointment'),
  });

  const busy = checkInMutation.isPending || updateStatusMutation.isPending;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await patientsApi.search(searchQuery);
      setSearchResults(res.data);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const loadPatientAppointments = async (patient: any) => {
    setSelectedPatient(patient);
    const all = [...todayAppts, ...pendingAppts].filter((a: any) =>
      a.patient_pid === patient.pid || a.patient_name === patient.name
    );
    const seen = new Set<string>();
    setPatientAppointments(
      all.filter((a: any) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      })
    );
  };

  const queue = todayAppts.filter((a: any) => ['checked_in', 'waiting', 'in_consultation'].includes(a.status));
  const waiting = todayAppts.filter((a: any) => a.status === 'waiting');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Reception Dashboard</h1>
          <p className="text-neutral-500 text-sm">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Pending', value: pendingAppts.length, color: 'text-amber-600' },
            { label: 'In Queue', value: queue.length, color: 'text-blue-600' },
            { label: 'Waiting', value: waiting.length, color: 'text-emerald-600' },
            { label: 'Total Today', value: todayAppts.length, color: 'text-neutral-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl px-4 py-3 border border-neutral-200 shadow-sm text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-neutral-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-neutral-900">Pending Approvals</h2>
            {pendingAppts.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {pendingAppts.length}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">Booked appointments awaiting reception approval</p>
        </div>

        {pendingLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 skeleton rounded-xl bg-neutral-100" />)}</div>
        ) : pendingAppts.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">No bookings awaiting approval</p>
        ) : (
          <div className="space-y-3">
            {pendingAppts.map((appt: Appointment) => (
              <PendingCard
                key={appt.id}
                appt={appt}
                busy={busy}
                onApprove={() => updateStatusMutation.mutate({ id: appt.id, status: 'checked_in' })}
                onDeny={() => updateStatusMutation.mutate({ id: appt.id, status: 'cancelled' })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-In by PID Search */}
        <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-neutral-900">Check-In Patient</h2>
          </div>

          <div className="flex gap-2">
            <input
              id="patient-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by PID, name, or phone..."
              className="flex-1 px-3 py-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <button onClick={handleSearch} disabled={searching}
              id="search-patient-btn"
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((p: any) => (
                <button key={p.id} onClick={() => loadPatientAppointments(p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                    ${selectedPatient?.id === p.id ? 'border-purple-300 bg-purple-50' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}`}>
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{p.name}</p>
                    <p className="text-xs text-neutral-500 font-mono">{p.pid} • {p.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPatient && (
            <div className="border-t border-neutral-200 pt-4">
              <p className="text-xs text-neutral-500 mb-3">Appointments for {selectedPatient.name}</p>
              {patientAppointments.length === 0 ? (
                <p className="text-sm text-neutral-500">No appointments found</p>
              ) : patientAppointments.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 mb-2">
                  <div className="flex-1">
                    <p className="text-sm text-neutral-900">{appt.doctor_name}</p>
                    <p className="text-xs text-neutral-500">
                      {format(new Date(appt.scheduled_at), 'dd MMM h:mm a')}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  {appt.status === 'booked' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: appt.id, status: 'checked_in' })}
                        disabled={busy}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: appt.id, status: 'cancelled' })}
                        disabled={busy}
                        className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                  {appt.status === 'checked_in' && (
                    <button
                      id={`check-in-btn-${appt.id}`}
                      onClick={() => checkInMutation.mutate(appt.id)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg flex items-center gap-1.5">
                      {checkInMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Check In
                    </button>
                  )}
                  {appt.status === 'waiting' && (
                    <span className="text-xs font-medium text-emerald-700">Ready in queue</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Queue Board */}
        <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-neutral-900">Live Queue Board</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl bg-neutral-100" />)}</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((appt: any) => (
                <div key={appt.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                  ${appt.status === 'in_consultation' ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold text-sm">
                    #{appt.queue_position || '—'}
                  </div>
                  <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${PRIORITY_COLOR[appt.priority] || 'bg-neutral-300'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{appt.patient_name}</p>
                    <p className="text-xs text-neutral-500">{appt.doctor_name} • {format(new Date(appt.scheduled_at), 'h:mm a')}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's All Appointments */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" /> All Today&apos;s Appointments
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 border-b border-neutral-200">
                {['Time', 'Patient', 'PID', 'Doctor', 'Priority', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayAppts.map((appt: any) => (
                <tr key={appt.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-3 px-3 text-neutral-700">{format(new Date(appt.scheduled_at), 'h:mm a')}</td>
                  <td className="py-3 px-3 text-neutral-900 font-medium">{appt.patient_name}</td>
                  <td className="py-3 px-3 text-neutral-500 font-mono text-xs">{appt.patient_pid}</td>
                  <td className="py-3 px-3 text-neutral-700">{appt.doctor_name}</td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border priority-${appt.priority}`}>{appt.priority}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>{appt.status.replace('_',' ')}</span>
                  </td>
                  <td className="py-3 px-3">
                    {appt.status === 'booked' && (
                      <>
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: appt.id, status: 'checked_in' })}
                          disabled={busy}
                          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-all disabled:opacity-50">
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: appt.id, status: 'cancelled' })}
                          disabled={busy}
                          className="ml-2 text-xs px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100 transition-all disabled:opacity-50">
                          Deny
                        </button>
                      </>
                    )}
                    {appt.status === 'checked_in' && (
                      <button onClick={() => checkInMutation.mutate(appt.id)}
                        disabled={busy}
                        className="text-xs px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded hover:bg-emerald-100 transition-all disabled:opacity-50">
                        Check In
                      </button>
                    )}
                    {appt.status === 'booked' && (
                      <button
                        onClick={() => appointmentsApi.updatePresence(appt.id, 'late').then(invalidateAll)}
                        className="ml-2 text-xs px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded hover:bg-amber-100 transition-all">
                        Late
                      </button>
                    )}
                    {['booked', 'late'].includes(appt.status) && (
                      <button
                        onClick={() => appointmentsApi.updatePresence(appt.id, 'absent').then(invalidateAll)}
                        className="ml-2 text-xs px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100 transition-all">
                        Absent
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {todayAppts.length === 0 && (
            <p className="text-center text-neutral-500 text-sm py-8">No appointments today</p>
          )}
        </div>
      </div>
    </div>
  );
}
