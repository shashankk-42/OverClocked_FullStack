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
        <h1 className="text-2xl font-bold text-white">Patient Check-In</h1>
        <p className="mt-1 text-sm text-slate-400">Search PID, name, or phone and move booked visits into the live queue.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="glass-card rounded-xl border border-slate-700/50 p-5">
          <div className="mb-4 flex items-center gap-2"><QrCode className="h-5 w-5 text-blue-400" /><h2 className="font-semibold text-white">Lookup Patient</h2></div>
          <div className="flex gap-3">
            <input id="checkin-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="PID, name, phone" className="h-11 flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 text-sm text-white outline-none focus:border-blue-500" />
            <button id="checkin-search-btn" onClick={search} className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {patients.map((patient) => (
              <button key={patient.id} onClick={() => setSelected(patient)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === patient.id ? 'border-blue-500 bg-blue-600/10' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'}`}>
                <p className="font-medium text-white">{patient.name}</p>
                <p className="font-mono text-xs text-slate-400">{patient.pid} | {patient.phone}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-xl border border-slate-700/50 p-5">
          <div className="mb-4 flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-400" /><h2 className="font-semibold text-white">Today&apos;s Visits</h2></div>
          {!selected ? <p className="text-sm text-slate-500">Select a patient to see check-in actions.</p> : null}
          <div className="space-y-3">
            {selectedAppointments.map((appt: any) => (
              <div key={appt.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{appt.doctor_name}</p>
                    <p className="text-xs text-slate-400">{appt.department} | {format(new Date(appt.scheduled_at), 'h:mm a')}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs status-${appt.status}`}>{appt.status.replace('_', ' ')}</span>
                  </div>
                  {appt.status === 'booked' ? (
                    <button id={`checkin-${appt.id}`} onClick={() => checkInMutation.mutate(appt.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
                      <CheckCircle className="h-4 w-4" /> Check In
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {selected && selectedAppointments.length === 0 ? <p className="text-sm text-slate-500">No appointments today for {selected.name}.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
