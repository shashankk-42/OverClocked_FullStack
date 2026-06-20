'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientsApi } from '@/lib/api';
import { CalendarDays, Droplets, IdCard, Loader2, Phone, ShieldAlert, User } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientProfilePage() {
  const queryClient = useQueryClient();
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient-me'],
    queryFn: () => patientsApi.me().then((res) => res.data),
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: () => patientsApi.updateMe(form),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['patient-me'] });
    },
    onError: () => toast.error('Could not update profile'),
  });

  const value = (field: string) => form[field] ?? patient?.[field] ?? '';

  if (isLoading) {
    return <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-500" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Keep your clinical identity and emergency details current.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="app-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <IdCard className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Patient ID</p>
              <p className="font-mono text-lg font-bold text-neutral-900">{patient?.pid}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <Info icon={User} label="Name" value={patient?.name} />
            <Info icon={Phone} label="Phone" value={patient?.phone} />
            <Info icon={CalendarDays} label="Date of Birth" value={patient?.dob || 'Not set'} />
            <Info icon={Droplets} label="Blood Group" value={patient?.blood_group || 'Not set'} />
            <Info icon={ShieldAlert} label="Allergies" value={patient?.allergies || 'None listed'} />
          </div>
        </section>

        <section className="app-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-neutral-900">Editable Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              ['name', 'Full Name'],
              ['email', 'Email'],
              ['gender', 'Gender'],
              ['blood_group', 'Blood Group'],
              ['allergies', 'Allergies'],
              ['emergency_contact_name', 'Emergency Contact Name'],
              ['emergency_contact_phone', 'Emergency Contact Phone'],
            ].map(([field, label]) => (
              <label key={field} className="space-y-1.5">
                <span className="text-xs font-medium text-neutral-500">{label}</span>
                <input
                  id={`profile-${field}`}
                  value={value(field)}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                  className="app-input h-10"
                />
              </label>
            ))}
          </div>
          <button
            id="save-profile-btn"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || Object.keys(form).length === 0}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </button>
        </section>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-neutral-500" />
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-neutral-900">{value || 'Not set'}</p>
      </div>
    </div>
  );
}
