'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '@/lib/api';
import { format } from 'date-fns';
import { CalendarClock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReceptionAppointmentsPage() {
  const queryClient = useQueryClient();
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['reception-today'],
    queryFn: () => appointmentsApi.today().then((res) => res.data),
    refetchInterval: 15000,
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.checkIn(id),
    onSuccess: () => {
      toast.success('Patient checked in');
      queryClient.invalidateQueries({ queryKey: ['reception-today'] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Appointments</h1>
        <p className="page-subtitle">Reception view for today&apos;s bookings, queue state, and check-ins.</p>
      </div>

      <div className="app-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-4">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          <p className="font-semibold text-neutral-900">{appointments.length} visits today</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  {['Time', 'Patient', 'PID', 'Doctor', 'Department', 'Priority', 'Status', 'Action'].map((head) => <th key={head} className="px-4 py-3 font-medium">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt: any) => (
                  <tr key={appt.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-700">{format(new Date(appt.scheduled_at), 'h:mm a')}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{appt.patient_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{appt.patient_pid}</td>
                    <td className="px-4 py-3 text-neutral-700">{appt.doctor_name}</td>
                    <td className="px-4 py-3 text-neutral-500">{appt.department}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs priority-${appt.priority}`}>{appt.priority}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs status-${appt.status}`}>{appt.status.replace('_', ' ')}</span></td>
                    <td className="px-4 py-3">
                      {appt.status === 'booked' ? (
                        <button onClick={() => checkInMutation.mutate(appt.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">
                          <CheckCircle className="h-3 w-3" /> Check In
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
