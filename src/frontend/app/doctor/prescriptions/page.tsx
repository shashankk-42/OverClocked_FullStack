'use client';

import { useQuery } from '@tanstack/react-query';
import { consultationsApi } from '@/lib/api';
import { format } from 'date-fns';
import { FileText, Loader2, Pill } from 'lucide-react';

export default function DoctorPrescriptionsPage() {
  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['doctor-prescriptions'],
    queryFn: () => consultationsApi.listPrescriptions().then((res) => res.data),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Prescriptions</h1>
        <p className="page-subtitle">All prescriptions created from doctor consultations.</p>
      </div>

      <div className="app-card overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4">
          <p className="text-sm font-semibold text-neutral-900">{prescriptions.length} prescriptions</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-500" /></div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {prescriptions.map((rx: any) => (
              <div key={rx.id} className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <p className="font-semibold text-neutral-900">{rx.patient_name}</p>
                    <span className="font-mono text-xs text-neutral-500">{rx.patient_pid}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{rx.diagnosis || 'No diagnosis recorded'}</p>
                  <p className="mt-1 text-xs text-neutral-500">{format(new Date(rx.created_at), 'dd MMM yyyy, h:mm a')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rx.medicines?.slice(0, 4).map((med: any, idx: number) => (
                    <span key={`${rx.id}-${idx}`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                      <Pill className="h-3 w-3" /> {med.name}
                    </span>
                  ))}
                </div>
                <span className={`w-fit rounded-full px-2 py-1 text-xs font-medium status-${rx.status}`}>{rx.status}</span>
              </div>
            ))}
            {prescriptions.length === 0 ? <p className="p-8 text-center text-sm text-neutral-500">No prescriptions created yet.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
