'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nurseApi } from '@/lib/api';
import { format } from 'date-fns';
import { Activity, AlertTriangle, Bed, ClipboardList, HeartPulse, Loader2, Pill, Send, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

type Assignment = {
  id: string;
  patient: {
    id: string;
    pid: string;
    name: string;
    blood_group?: string;
    allergies?: string;
  };
  priority: string;
  status: string;
  room_number?: string | null;
  bed_number?: string | null;
  appointment_status?: string | null;
  instructions?: string | null;
  vitals: Record<string, { value: string; unit?: string; recorded_at: string }>;
  medications: { id: string; medication_name: string; dosage?: string; frequency?: string; status: string }[];
};

const emptyVitals = {
  blood_pressure: '',
  heart_rate: '',
  temperature: '',
  oxygen_saturation: '',
  weight: '',
  height: '',
};

export default function NurseDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vitals, setVitals] = useState(emptyVitals);
  const [note, setNote] = useState('');
  const [doctorReason, setDoctorReason] = useState('');
  const [emergencySeverity, setEmergencySeverity] = useState('Critical');

  const { data, isLoading } = useQuery({
    queryKey: ['nurse-dashboard'],
    queryFn: () => nurseApi.dashboard().then((res) => res.data),
    refetchInterval: 15000,
  });

  const assignments: Assignment[] = data?.assignments || [];
  const selected = useMemo(
    () => assignments.find((item) => item.id === selectedId) || assignments[0],
    [assignments, selectedId]
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['nurse-dashboard'] });

  const vitalsMutation = useMutation({
    mutationFn: () => nurseApi.recordVitals({ ...vitals, patient_id: selected?.patient.id }),
    onSuccess: () => {
      toast.success('Vitals recorded');
      setVitals(emptyVitals);
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not record vitals'),
  });

  const medicationMutation = useMutation({
    mutationFn: (med: Assignment['medications'][number]) =>
      nurseApi.administerMedication({
        patient_id: selected?.patient.id,
        medication_timeline_item_id: med.id,
        medication_name: med.medication_name,
        status: 'taken',
      }),
    onSuccess: () => {
      toast.success('Medication marked administered');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not update medication'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ assignmentId, status }: { assignmentId: string; status: string }) =>
      nurseApi.updateAssignment(assignmentId, { status }),
    onSuccess: () => {
      toast.success('Patient status updated');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not update status'),
  });

  const noteMutation = useMutation({
    mutationFn: () => nurseApi.addNote({ patient_id: selected?.patient.id, body: note, note_type: 'nursing' }),
    onSuccess: () => {
      toast.success('Nursing note added');
      setNote('');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not add note'),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      nurseApi.requestDoctorReview({
        patient_id: selected?.patient.id,
        reason: doctorReason,
        priority: selected?.priority || 'medium',
      }),
    onSuccess: () => {
      toast.success('Doctor review requested');
      setDoctorReason('');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not request review'),
  });

  const emergencyMutation = useMutation({
    mutationFn: () =>
      nurseApi.escalateEmergency({
        patient_id: selected?.patient.id,
        severity: emergencySeverity,
        location: [selected?.room_number, selected?.bed_number].filter(Boolean).join(' / '),
        notes: `Escalated from nurse dashboard for ${selected?.patient.name}`,
      }),
    onSuccess: () => {
      toast.success('Emergency escalated');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not escalate emergency'),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Nurse Workspace</p>
          <h1 className="text-2xl font-bold text-neutral-900">Patient Monitoring Center</h1>
          <p className="mt-1 text-sm text-neutral-500">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Assigned', value: assignments.length, color: 'text-blue-600' },
            { label: 'Tasks', value: data?.pending_tasks || 0, color: 'text-amber-600' },
            { label: 'Alerts', value: data?.emergencies?.length || 0, color: 'text-red-600' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center rounded-2xl border border-neutral-200 bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <Activity className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="font-semibold text-neutral-900">No assigned patients</p>
          <p className="mt-1 text-sm text-neutral-500">Assignments appear here when patients need monitoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <section className="space-y-3">
            {assignments.map((assignment) => (
              <button
                key={assignment.id}
                onClick={() => setSelectedId(assignment.id)}
                className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition ${
                  selected?.id === assignment.id ? 'border-blue-300 ring-2 ring-blue-50' : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">{assignment.patient.name}</p>
                    <p className="font-mono text-xs text-neutral-500">{assignment.patient.pid}</p>
                  </div>
                  <span className={`priority-${assignment.priority} rounded-full border px-2 py-0.5 text-xs capitalize`}>
                    {assignment.priority}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                  <span className={`status-${assignment.status} rounded-full border px-2 py-0.5 capitalize`}>
                    {assignment.status.replace(/_/g, ' ')}
                  </span>
                  {assignment.room_number && <span>Room {assignment.room_number}</span>}
                  {assignment.bed_number && <span>Bed {assignment.bed_number}</span>}
                </div>
              </button>
            ))}
          </section>

          {selected && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">{selected.patient.name}</h2>
                    <p className="font-mono text-sm text-neutral-500">{selected.patient.pid}</p>
                    <p className="mt-2 text-sm text-neutral-600">
                      Blood group: {selected.patient.blood_group || 'Unknown'} | Allergies: {selected.patient.allergies || 'None recorded'}
                    </p>
                    {selected.instructions && <p className="mt-2 text-sm text-neutral-700">{selected.instructions}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['monitoring', 'pending_review', 'ready_for_discharge'].map((status) => (
                      <button
                        key={status}
                        onClick={() => statusMutation.mutate({ assignmentId: selected.id, status })}
                        className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                      >
                        {status.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div id="vitals" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                    <HeartPulse className="h-5 w-5 text-emerald-600" /> Record Vitals
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Object.keys(emptyVitals).map((key) => (
                      <input
                        key={key}
                        value={vitals[key as keyof typeof emptyVitals]}
                        onChange={(event) => setVitals((prev) => ({ ...prev, [key]: event.target.value }))}
                        placeholder={key.replace(/_/g, ' ')}
                        className="app-input"
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => vitalsMutation.mutate()}
                    disabled={vitalsMutation.isPending}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {vitalsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
                    Save Vitals
                  </button>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                    <Activity className="h-5 w-5 text-blue-600" /> Latest Vitals
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Object.entries(selected.vitals || {}).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        <p className="text-xs capitalize text-neutral-500">{key.replace(/_/g, ' ')}</p>
                        <p className="mt-1 font-semibold text-neutral-900">{value.value} {value.unit || ''}</p>
                      </div>
                    ))}
                    {Object.keys(selected.vitals || {}).length === 0 && <p className="text-sm text-neutral-500">No vitals recorded yet.</p>}
                  </div>
                </div>
              </div>

              <div id="medications" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                  <Pill className="h-5 w-5 text-amber-600" /> Medication Schedule
                </h3>
                <div className="space-y-3">
                  {selected.medications.map((med) => (
                    <div key={med.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-neutral-900">{med.medication_name}</p>
                        <p className="text-sm text-neutral-500">{med.dosage || 'Dose not set'} | {med.frequency || 'Frequency not set'}</p>
                      </div>
                      <button
                        onClick={() => medicationMutation.mutate(med)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Mark Administered
                      </button>
                    </div>
                  ))}
                  {selected.medications.length === 0 && <p className="text-sm text-neutral-500">No active medication schedule.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div id="notes" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                    <ClipboardList className="h-5 w-5 text-blue-600" /> Nursing Notes
                  </h3>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="app-input h-28 py-3" placeholder="Add observation or care note" />
                  <button
                    onClick={() => noteMutation.mutate()}
                    disabled={!note.trim() || noteMutation.isPending}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> Add Note
                  </button>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                    <Stethoscope className="h-5 w-5 text-purple-600" /> Doctor Review
                  </h3>
                  <textarea value={doctorReason} onChange={(event) => setDoctorReason(event.target.value)} rows={4} className="app-input h-28 py-3" placeholder="Reason for doctor review" />
                  <button
                    onClick={() => reviewMutation.mutate()}
                    disabled={!doctorReason.trim() || reviewMutation.isPending}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Stethoscope className="h-4 w-4" /> Request Review
                  </button>
                </div>
              </div>

              <div id="beds" className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { label: 'Total Beds', value: data?.bed_summary?.total || 0 },
                  { label: 'Occupied', value: data?.bed_summary?.occupied || 0 },
                  { label: 'Ready Discharge', value: data?.bed_summary?.ready_for_discharge || 0 },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <Bed className="mb-3 h-5 w-5 text-neutral-500" />
                    <p className="text-2xl font-bold text-neutral-900">{item.value}</p>
                    <p className="text-sm text-neutral-500">{item.label}</p>
                  </div>
                ))}
              </div>

              <div id="emergencies" className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-red-900">
                  <AlertTriangle className="h-5 w-5 text-red-600" /> Emergency Escalation
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <select value={emergencySeverity} onChange={(event) => setEmergencySeverity(event.target.value)} className="app-input sm:w-56">
                    <option>Urgent</option>
                    <option>Critical</option>
                    <option>Life Threatening</option>
                  </select>
                  <button
                    onClick={() => emergencyMutation.mutate()}
                    disabled={emergencyMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4" /> Escalate Emergency
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
