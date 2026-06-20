'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { consultationsApi } from '@/lib/api';
import { format } from 'date-fns';
import { Calendar, Pill, FileText, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react';
import { useState } from 'react';

export default function MedicalHistoryPage() {
  const { user } = useAuth();
  const [expandedRx, setExpandedRx] = useState<string | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['patient-history', user?.linked_id],
    queryFn: () => consultationsApi.getPatientHistory(user!.linked_id!).then((r) => r.data),
    enabled: !!user?.linked_id,
  });

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
    </div>
  );

  const appointments = history?.appointments || [];
  const prescriptions = history?.prescriptions || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Medical History</h1>
        <p className="text-slate-400 mt-1">Your complete health timeline</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visits Timeline */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Appointments ({appointments.length})
          </h2>
          {appointments.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 border border-slate-700/50 text-center">
              <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No appointments yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt: any) => (
                <div key={appt.id} className="glass-card rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{appt.doctor_name}</p>
                      <p className="text-xs text-slate-500">{appt.department}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border status-${appt.status}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-400">
                      {format(new Date(appt.scheduled_at), 'dd MMM yyyy, h:mm a')}
                    </span>
                  </div>
                  {appt.chief_complaint && (
                    <p className="text-xs text-slate-400 mt-1">Reason: {appt.chief_complaint}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prescriptions */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Pill className="w-4 h-4" /> Prescriptions ({prescriptions.length})
          </h2>
          {prescriptions.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 border border-slate-700/50 text-center">
              <Pill className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No prescriptions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx: any) => (
                <div key={rx.id} className="glass-card rounded-xl border border-slate-700/50 overflow-hidden">
                  <button
                    onClick={() => setExpandedRx(expandedRx === rx.id ? null : rx.id)}
                    className="w-full p-4 text-left flex items-start justify-between hover:bg-white/5 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{rx.diagnosis || 'General Prescription'}</p>
                      <p className="text-xs text-slate-500">{rx.doctor_name} • {format(new Date(rx.created_at), 'dd MMM yyyy')}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border status-${rx.status}`}>
                          {rx.status}
                        </span>
                        <span className="text-xs text-slate-500">{rx.medicines?.length || 0} medicines</span>
                      </div>
                    </div>
                    {expandedRx === rx.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {expandedRx === rx.id && (
                    <div className="px-4 pb-4 border-t border-slate-700/50">
                      {rx.medicines && rx.medicines.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Medicines</p>
                          {rx.medicines.map((m: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 bg-slate-800/50 rounded-lg">
                              <Pill className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm text-white font-medium">{m.name} {m.dosage}</p>
                                <p className="text-xs text-slate-400">{m.frequency} • {m.duration}</p>
                                {m.instructions && <p className="text-xs text-slate-500 italic">{m.instructions}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {rx.soap_notes && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Consultation Notes</p>
                          {Object.entries(rx.soap_notes).map(([key, val]: any) => val && (
                            <div key={key} className="mb-2">
                              <p className="text-xs text-blue-400 capitalize font-medium">{key}</p>
                              <p className="text-xs text-slate-300">{val}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
