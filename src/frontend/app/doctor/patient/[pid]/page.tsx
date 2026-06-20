'use client';

import { useSearchParams } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { consultationsApi, patientsApi } from '@/lib/api';
import { format } from 'date-fns';
import { Activity, FileText, Loader2, Pill, ShieldAlert } from 'lucide-react';

export default function DoctorPatientPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const pid = String(params.pid || '');

  const { data: patient } = useQuery({
    queryKey: ['doctor-patient-by-pid', pid],
    queryFn: () => patientsApi.getByPid(pid).then((res) => res.data),
    enabled: !!pid,
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ['doctor-patient-history', patientId],
    queryFn: () => consultationsApi.getPatientHistory(patientId).then((res) => res.data),
    enabled: !!patientId,
  });

  if (isLoading) return <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="glass-card rounded-xl border border-slate-700/50 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Patient Record</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{patient?.name || history?.patient?.name}</h1>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <Metric label="PID" value={patient?.pid || history?.patient?.pid} />
          <Metric label="Phone" value={patient?.phone} />
          <Metric label="Gender" value={patient?.gender || history?.patient?.gender} />
          <Metric label="Blood" value={patient?.blood_group || history?.patient?.blood_group} />
          <Metric label="Allergies" value={patient?.allergies || history?.patient?.allergies || 'None'} warning />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="glass-card rounded-xl border border-slate-700/50 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white"><Activity className="h-5 w-5 text-blue-400" /> Visits</h2>
          <div className="space-y-3">
            {history?.appointments?.map((appt: any) => (
              <div key={appt.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                <p className="font-medium text-white">{appt.doctor_name}</p>
                <p className="text-xs text-slate-400">{appt.department} | {format(new Date(appt.scheduled_at), 'dd MMM yyyy, h:mm a')}</p>
                <p className="mt-2 text-sm text-slate-300">{appt.chief_complaint || 'No complaint recorded'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-xl border border-slate-700/50 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white"><Pill className="h-5 w-5 text-blue-400" /> Prescriptions</h2>
          <div className="space-y-3">
            {history?.prescriptions?.map((rx: any) => (
              <div key={rx.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                <p className="font-medium text-white">{rx.diagnosis || 'Diagnosis not recorded'}</p>
                <p className="text-xs text-slate-400">{rx.doctor_name} | {format(new Date(rx.created_at), 'dd MMM yyyy')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rx.medicines?.map((med: any, idx: number) => (
                    <span key={`${med.name}-${idx}`} className="rounded-full bg-blue-600/15 px-2 py-1 text-xs text-blue-300">{med.name} {med.dosage}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, warning }: { label: string; value?: string; warning?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-900/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 truncate font-medium ${warning ? 'text-amber-300' : 'text-white'}`}>{warning ? <ShieldAlert className="mr-1 inline h-3 w-3" /> : null}{value || '-'}</p>
    </div>
  );
}
