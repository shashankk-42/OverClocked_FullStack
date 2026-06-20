'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, patientsApi } from '@/lib/api';
import { format } from 'date-fns';
import { Search, QrCode, CheckCircle, Users, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PRIORITY_COLOR: Record<string, string> = {
  emergency: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function ReceptionDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);

  const { data: todayAppts = [], isLoading } = useQuery({
    queryKey: ['reception-today'],
    queryFn: () => appointmentsApi.today().then((r) => r.data),
    refetchInterval: 15000,
  });

  const checkInMutation = useMutation({
    mutationFn: (appointmentId: string) => appointmentsApi.checkIn(appointmentId),
    onSuccess: (data) => {
      toast.success(`Checked in! Queue position: #${data.data.queue_position}`);
      queryClient.invalidateQueries({ queryKey: ['reception-today'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Check-in failed'),
  });

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
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const all = todayAppts.filter((a: any) =>
        a.patient_pid === patient.pid || a.patient_name === patient.name
      );
      setPatientAppointments(all);
    } catch {
      setPatientAppointments([]);
    }
  };

  const queue = todayAppts.filter((a: any) => ['checked_in', 'in_consultation'].includes(a.status));
  const waiting = todayAppts.filter((a: any) => a.status === 'booked');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reception Dashboard</h1>
          <p className="text-slate-400 text-sm">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'In Queue', value: queue.length, color: 'text-blue-400' },
            { label: 'Waiting', value: waiting.length, color: 'text-amber-400' },
            { label: 'Total Today', value: todayAppts.length, color: 'text-slate-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-xl px-4 py-3 border border-slate-700/50 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-In by PID Search */}
        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-white">Check-In Patient</h2>
          </div>

          <div className="flex gap-2">
            <input
              id="patient-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by PID, name, or phone..."
              className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm"
            />
            <button onClick={handleSearch} disabled={searching}
              id="search-patient-btn"
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((p: any) => (
                <button key={p.id} onClick={() => loadPatientAppointments(p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                    ${selectedPatient?.id === p.id ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'}`}>
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.pid} • {p.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Patient's today appointments */}
          {selectedPatient && (
            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 mb-3">Today's Appointments for {selectedPatient.name}</p>
              {patientAppointments.length === 0 ? (
                <p className="text-sm text-slate-500">No appointments today</p>
              ) : patientAppointments.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="flex-1">
                    <p className="text-sm text-white">{appt.doctor_name}</p>
                    <p className="text-xs text-slate-400">{format(new Date(appt.scheduled_at), 'h:mm a')}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  {appt.status === 'booked' && (
                    <button
                      id={`check-in-btn-${appt.id}`}
                      onClick={() => checkInMutation.mutate(appt.id)}
                      disabled={checkInMutation.isPending}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg flex items-center gap-1.5">
                      {checkInMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Check In
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Queue Board */}
        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Live Queue Board</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((appt: any) => (
                <div key={appt.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                  ${appt.status === 'in_consultation' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
                    #{appt.queue_position}
                  </div>
                  <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${PRIORITY_COLOR[appt.priority] || 'bg-slate-600'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{appt.patient_name}</p>
                    <p className="text-xs text-slate-400">{appt.doctor_name} • {format(new Date(appt.scheduled_at), 'h:mm a')}</p>
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
      <div className="glass-card rounded-2xl p-5 border border-slate-700/50">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" /> All Today's Appointments
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-700">
                {['Time', 'Patient', 'PID', 'Doctor', 'Priority', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayAppts.map((appt: any) => (
                <tr key={appt.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 text-slate-300">{format(new Date(appt.scheduled_at), 'h:mm a')}</td>
                  <td className="py-3 px-3 text-white font-medium">{appt.patient_name}</td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-xs">{appt.patient_pid}</td>
                  <td className="py-3 px-3 text-slate-300">{appt.doctor_name}</td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border priority-${appt.priority}`}>{appt.priority}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>{appt.status.replace('_',' ')}</span>
                  </td>
                  <td className="py-3 px-3">
                    {appt.status === 'booked' && (
                      <button onClick={() => checkInMutation.mutate(appt.id)}
                        disabled={checkInMutation.isPending}
                        className="text-xs px-2 py-1 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded hover:bg-emerald-600/40 transition-all">
                        Check In
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {todayAppts.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-8">No appointments today</p>
          )}
        </div>
      </div>
    </div>
  );
}
