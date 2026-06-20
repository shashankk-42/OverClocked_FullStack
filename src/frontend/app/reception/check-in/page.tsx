'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, patientsApi } from '@/lib/api';
import { format } from 'date-fns';
import { CheckCircle, Loader2, QrCode, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ReceptionCheckInPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: appointments = [] } = useQuery({
    queryKey: ['reception-today'],
    queryFn: () => appointmentsApi.today().then((res) => res.data),
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.checkIn(id),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Patient checked in');
      queryClient.invalidateQueries({ queryKey: ['reception-today'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Check-in failed'),
  });

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await patientsApi.search(query.trim());
      setPatients(res.data);
    } catch {
      toast.error('Patient search failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedAppointments = appointments.filter((appt: any) => selected && appt.patient_pid === selected.pid);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Patient Check-In</h1>
        <p className="page-subtitle">Search PID, name, or phone and move booked visits into the live queue.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="app-card p-5">
          <div className="mb-4 flex items-center gap-2"><QrCode className="h-5 w-5 text-purple-600" /><h2 className="font-semibold text-neutral-900">Lookup Patient</h2></div>
          <div className="flex gap-3">
            <input id="checkin-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="PID, name, phone" className="app-input flex-1" />
            <button id="checkin-search-btn" onClick={search} className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {patients.map((patient) => (
              <button key={patient.id} onClick={() => setSelected(patient)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === patient.id ? 'border-purple-300 bg-purple-50' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}`}>
                <p className="font-medium text-neutral-900">{patient.name}</p>
                <p className="font-mono text-xs text-neutral-500">{patient.pid} | {patient.phone}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="app-card p-5">
          <div className="mb-4 flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-600" /><h2 className="font-semibold text-neutral-900">Today&apos;s Visits</h2></div>
          {!selected ? <p className="text-sm text-neutral-500">Select a patient to see check-in actions.</p> : null}
          <div className="space-y-3">
            {selectedAppointments.map((appt: any) => (
              <div key={appt.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">{appt.doctor_name}</p>
                    <p className="text-xs text-neutral-500">{appt.department} | {format(new Date(appt.scheduled_at), 'h:mm a')}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs status-${appt.status}`}>{appt.status.replace('_', ' ')}</span>
                  </div>
                  {appt.status === 'booked' ? (
                    <button id={`checkin-${appt.id}`} onClick={() => checkInMutation.mutate(appt.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                      <CheckCircle className="h-4 w-4" /> Check In
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {selected && selectedAppointments.length === 0 ? <p className="text-sm text-neutral-500">No appointments today for {selected.name}.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
