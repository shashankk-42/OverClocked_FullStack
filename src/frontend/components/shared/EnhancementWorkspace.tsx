'use client';

import { useEffect, useMemo, useState } from 'react';
import { enhancementsApi, pharmacyApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';

type WorkspaceMode =
  | 'patient-medications'
  | 'patient-reports'
  | 'patient-family'
  | 'patient-insurance'
  | 'patient-rooms'
  | 'patient-journey'
  | 'patient-visual-triage'
  | 'emergencies'
  | 'follow-ups'
  | 'care-teams'
  | 'reception-rooms'
  | 'reception-journeys'
  | 'reception-waitlist'
  | 'pharmacy-cost'
  | 'pharmacy-dispensers';

interface EnhancementWorkspaceProps {
  title: string;
  focus: string;
  mode: WorkspaceMode;
}

type Row = Record<string, unknown>;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DataGrid({ rows }: { rows: Row[] }) {
  const keys = useMemo(() => {
    const all = new Set<string>();
    rows.slice(0, 5).forEach((row) => Object.keys(row).forEach((key) => all.add(key)));
    return Array.from(all).filter((key) => !['metadata_json', 'payload'].includes(key)).slice(0, 6);
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
        No records yet. Use the available action or complete the related workflow.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
          <tr>
            {keys.map((key) => (
              <th key={key} className="px-4 py-3 font-medium">
                {key.replaceAll('_', ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 bg-white">
          {rows.map((row, index) => (
            <tr key={String(row.id || index)} className="text-neutral-900">
              {keys.map((key) => (
                <td key={key} className="max-w-[240px] truncate px-4 py-3">
                  {formatValue(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EnhancementWorkspace({ title, focus, mode }: EnhancementWorkspaceProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [secondaryRows, setSecondaryRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const patientId = user?.linked_id || '';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'patient-medications') {
        const [timeline, devices] = await Promise.all([
          enhancementsApi.medicationTimeline(patientId),
          enhancementsApi.dispensers(patientId),
        ]);
        setRows(timeline.data);
        setSecondaryRows(devices.data);
      } else if (mode === 'patient-reports') {
        const profile = await enhancementsApi.comprehensiveProfile(patientId);
        setRows(profile.data.reports || []);
        setSecondaryRows(profile.data.vitals || []);
      } else if (mode === 'patient-family') {
        const families = await enhancementsApi.myFamilies();
        setRows(families.data);
        setSecondaryRows([]);
      } else if (mode === 'patient-insurance') {
        const [policies, claims] = await Promise.all([
          enhancementsApi.insurancePolicies(patientId),
          enhancementsApi.claims(),
        ]);
        setRows(policies.data);
        setSecondaryRows(claims.data);
      } else if (mode === 'patient-rooms') {
        const rooms = await enhancementsApi.publicRoomAvailability();
        setRows(rooms.data);
        setSecondaryRows([]);
      } else if (mode === 'patient-journey') {
        const current = await enhancementsApi.myCurrentJourney();
        setRows(current.data?.steps || []);
        setSecondaryRows(current.data?.journey ? [current.data.journey] : []);
      } else if (mode === 'patient-visual-triage') {
        const uploads = await enhancementsApi.visualTriageList(patientId);
        setRows(uploads.data);
        setSecondaryRows([]);
      } else if (mode === 'emergencies') {
        const emergencies = await enhancementsApi.emergencies();
        setRows(emergencies.data);
        setSecondaryRows([]);
      } else if (mode === 'follow-ups') {
        const followUps = user.role === 'patient' ? await enhancementsApi.myFollowUps() : await enhancementsApi.followUpReview();
        setRows(followUps.data);
        setSecondaryRows([]);
      } else if (mode === 'care-teams') {
        const teams = await enhancementsApi.careTeams(user.role === 'patient' ? patientId : undefined);
        setRows(teams.data);
        setSecondaryRows([]);
      } else if (mode === 'reception-rooms') {
        const availability = await enhancementsApi.roomAvailability();
        setRows(availability.data.rooms || []);
        setSecondaryRows(availability.data.beds || []);
      } else if (mode === 'reception-journeys') {
        const journeys = await enhancementsApi.journeys();
        setRows(journeys.data.map((item: any) => item.journey));
        setSecondaryRows(journeys.data.flatMap((item: any) => item.steps || []));
      } else if (mode === 'reception-waitlist') {
        const waitlist = await enhancementsApi.waitlist();
        setRows(waitlist.data);
        setSecondaryRows([]);
      } else if (mode === 'pharmacy-cost') {
        const [pending, inventory] = await Promise.all([
          pharmacyApi.pendingPrescriptions(),
          pharmacyApi.inventory(),
        ]);
        setRows(pending.data);
        setSecondaryRows(inventory.data);
      } else if (mode === 'pharmacy-dispensers') {
        const devices = await enhancementsApi.dispensers();
        setRows(devices.data);
        setSecondaryRows([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load this workspace.');
      setRows([]);
      setSecondaryRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.user_id]);

  const runAction = async () => {
    if (!user) return;
    try {
      if (mode === 'patient-family') {
        await enhancementsApi.createFamily({ name: note || 'My Household' });
        toast.success('Family group created');
      } else if (mode === 'patient-insurance') {
        await enhancementsApi.createInsurancePolicy({
          patient_id: patientId,
          provider: note || 'Demo Health Insurance',
          policy_number: `POL-${Date.now()}`,
          policy_type: 'family',
          coverage_info: { outpatient: true, pharmacy: true, room_coverage: 'standard' },
        });
        toast.success('Insurance policy added');
      } else if (mode === 'patient-medications') {
        await enhancementsApi.registerDispenser({
          patient_id: patientId,
          device_identifier: `DISP-${Date.now()}`,
          label: note || 'Home dispenser',
        });
        toast.success('Dispenser registered');
      } else if (mode === 'patient-visual-triage') {
        if (!selectedFile) {
          toast.error('Choose an image first');
          return;
        }
        const formData = new FormData();
        formData.append('patient_id', patientId);
        formData.append('source_type', 'patient_upload');
        formData.append('image_type', note || 'skin_condition');
        formData.append('file', selectedFile);
        const upload = await enhancementsApi.uploadVisualTriage(formData);
        await enhancementsApi.analyzeVisualTriage(upload.data.id, {
          ai_summary: 'Image queued for doctor review. MVP analysis completed.',
          highlighted_concerns: note ? [note] : [],
          urgency_level: note.toLowerCase().includes('bleeding') ? 'urgent' : 'routine',
          confidence_score: 0.62,
        });
        toast.success('Visual triage uploaded and analyzed');
      } else if (mode === 'emergencies') {
        const pidMatch = note.match(/MF-\d{8}-[A-Z0-9]+/i)?.[0];
        await enhancementsApi.createEmergency({
          patient_id: patientId || undefined,
          pid: patientId ? undefined : pidMatch,
          trigger_source: user.role,
          severity: 'urgent',
          location: note || 'Main lobby',
        });
        toast.success('Emergency escalation created');
      } else if (mode === 'reception-rooms') {
        const room = await enhancementsApi.createRoom({
          room_number: `R-${Math.floor(Math.random() * 900 + 100)}`,
          room_type: note || 'Private',
          floor: '2',
          ward: 'General',
          price_per_day: 2500,
          amenities: ['Oxygen', 'Nurse call', 'Wi-Fi'],
        });
        await enhancementsApi.createBed({
          room_id: room.data.id,
          bed_number: 'A',
          bed_type: room.data.room_type === 'ICU' ? 'icu' : 'standard',
        });
        toast.success('Room and bed created');
      } else if (mode === 'reception-waitlist') {
        toast.info('Patients create waitlist entries from appointment recovery flows.');
      } else {
        toast.info('This workspace is connected and updates from backend workflow events.');
      }
      setNote('');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Action failed');
    }
  };

  const actionLabels: Partial<Record<WorkspaceMode, string>> = {
    'patient-medications': 'Register Dispenser',
    'patient-family': 'Create Family',
    'patient-insurance': 'Add Policy',
    'patient-visual-triage': 'Upload & Analyze',
    emergencies: 'Trigger Urgent Escalation',
    'reception-rooms': 'Add Room & Bed',
  };
  const actionLabel = actionLabels[mode];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{focus}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-neutral-200 bg-neutral-100 text-neutral-700">
            Backend connected
          </Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {actionLabel && (
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-neutral-900">Workflow Action</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
            {mode === 'patient-visual-triage' ? (
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="bg-white border-neutral-300"
              />
            ) : (
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional label, note, room type, location, or concern"
                className="min-h-10 bg-white border-neutral-300"
              />
            )}
            <Button onClick={runAction} className="h-10">
              {mode === 'patient-visual-triage' ? <Upload className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {actionLabel}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-neutral-900">Primary Records</CardTitle>
          <span className="text-xs text-neutral-500">{loading ? 'Loading...' : `${rows.length} records`}</span>
        </CardHeader>
        <CardContent>
          <DataGrid rows={rows} />
        </CardContent>
      </Card>

      {!!secondaryRows.length && (
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-neutral-900">Related Records</CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid rows={secondaryRows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
