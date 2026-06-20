'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { consultationsApi, aiApi } from '@/lib/api';
import { format } from 'date-fns';
import { Brain, FileText, Pill, AlertTriangle, Loader2, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';

export default function ConsultationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const appointmentId = params.id as string;
  const patientId = searchParams.get('patientId') || '';
  const pid = searchParams.get('pid') || '';

  const [activeTab, setActiveTab] = useState<'summary' | 'notes' | 'prescription'>('summary');
  const [transcript, setTranscript] = useState('');
  const [soapNotes, setSoapNotes] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<any[]>([]);
  const [drugCheckResult, setDrugCheckResult] = useState<any>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [rxLoading, setRxLoading] = useState(false);
  const [drugLoading, setDrugLoading] = useState(false);

  // Patient summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['patient-summary', patientId],
    queryFn: () => consultationsApi.getPatientSummary(patientId).then((r) => r.data),
    enabled: !!patientId,
  });

  // Patient history
  const { data: historyData } = useQuery({
    queryKey: ['patient-history-doc', patientId],
    queryFn: () => consultationsApi.getPatientHistory(patientId).then((r) => r.data),
    enabled: !!patientId,
  });

  const generateSoap = async () => {
    if (!transcript.trim()) return;
    setNotesLoading(true);
    try {
      const res = await aiApi.soapNotes(transcript, patientId, appointmentId);
      setSoapNotes(res.data);
      toast.success('SOAP notes generated!');
    } catch {
      toast.error('Failed to generate notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const generateRx = async () => {
    if (!diagnosis.trim()) return;
    setRxLoading(true);
    try {
      const res = await aiApi.generatePrescription(diagnosis, patientId);
      setMedicines(res.data.medicines || []);
      toast.success('Prescription suggestions generated!');
    } catch {
      toast.error('Failed to generate prescription');
    } finally {
      setRxLoading(false);
    }
  };

  const checkInteractions = async () => {
    if (medicines.length === 0) return;
    setDrugLoading(true);
    try {
      const medicineNames = medicines.map((m: any) => m.name);
      const res = await aiApi.drugInteraction(medicineNames, patientId);
      setDrugCheckResult(res.data);
    } catch {
      toast.error('Drug interaction check failed');
    } finally {
      setDrugLoading(false);
    }
  };

  const savePrescriptionMutation = useMutation({
    mutationFn: () => consultationsApi.createPrescription({
      patient_id: patientId,
      appointment_id: appointmentId,
      diagnosis,
      medicines,
      soap_notes: soapNotes,
      drug_interactions: drugCheckResult?.interactions || [],
    }),
    onSuccess: () => {
      toast.success('Prescription saved and sent to pharmacy!');
      router.push('/doctor/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to save prescription');
    },
  });

  const summary = summaryData?.summary;
  const context = summaryData?.context;

  const RISK_COLOR: Record<string, string> = {
    low: 'text-green-400 bg-green-500/10',
    moderate: 'text-yellow-400 bg-yellow-500/10',
    high: 'text-red-400 bg-red-500/10',
    unknown: 'text-slate-400 bg-slate-500/10',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Consultation</h1>
          <p className="text-slate-400 text-sm">Patient: <span className="text-blue-400 font-mono">{pid}</span></p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-400 hover:text-white">
          ← Back to queue
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-xl w-fit">
        {(['summary', 'notes', 'prescription'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-lg font-medium capitalize transition-all
              ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'notes' ? 'SOAP Notes' : tab === 'prescription' ? 'Prescription' : 'Patient Summary'}
          </button>
        ))}
      </div>

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {summaryLoading ? (
            <div className="glass-card rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 text-blue-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>AI is analyzing patient history...</span>
              </div>
            </div>
          ) : summary ? (
            <>
              {/* AI Summary */}
              <div className="glass-card rounded-2xl p-6 border border-blue-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-400" />
                    <h2 className="font-semibold text-white">AI Clinical Summary</h2>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_COLOR[summary.risk_level] || RISK_COLOR.unknown}`}>
                    {summary.risk_level?.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">{summary.summary}</p>

                <div className="grid grid-cols-2 gap-4">
                  {summary.active_conditions?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 font-medium uppercase">Active Conditions</p>
                      <div className="space-y-1">
                        {summary.active_conditions.map((c: string) => (
                          <div key={c} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-orange-400" />
                            <span className="text-xs text-slate-300">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.key_alerts?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 font-medium uppercase">⚠ Key Alerts</p>
                      <div className="space-y-1">
                        {summary.key_alerts.map((alert: string) => (
                          <div key={alert} className="flex items-start gap-2">
                            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-amber-300">{alert}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Context info */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Age', value: context?.age },
                  { label: 'Gender', value: context?.gender },
                  { label: 'Blood Group', value: context?.blood_group },
                  { label: 'Allergies', value: context?.allergies },
                ].map(({ label, value }) => value && value !== 'Unknown' && (
                  <div key={label} className="glass-card rounded-xl p-3 border border-slate-700/50">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm font-medium text-white mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Recent prescriptions from history */}
              {historyData?.prescriptions?.slice(0, 2).map((rx: any) => (
                <div key={rx.id} className="glass-card rounded-xl p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">{format(new Date(rx.created_at), 'dd MMM yyyy')} — {rx.doctor_name}</p>
                  <p className="text-sm font-medium text-white">{rx.diagnosis}</p>
                  <p className="text-xs text-slate-400">{rx.medicines?.length || 0} medicines prescribed</p>
                </div>
              ))}
            </>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center border border-slate-700/50">
              <p className="text-slate-400">No history found for this patient</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: SOAP Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-6 border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold text-white">AI SOAP Note Generator</h2>
            </div>
            <p className="text-sm text-slate-400">Type or dictate your consultation notes. AI will structure them into SOAP format.</p>
            <textarea
              id="soap-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Patient presents with 3-day history of fever (102°F), productive cough, and mild shortness of breath. On examination: BP 120/80, Pulse 98, SpO2 96%..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
            <button onClick={generateSoap} disabled={!transcript.trim() || notesLoading}
              id="generate-soap-btn"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              {notesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {notesLoading ? 'Generating SOAP Notes...' : 'Generate SOAP Notes'}
            </button>
          </div>

          {soapNotes && (
            <div className="glass-card rounded-2xl p-6 border border-emerald-500/20 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Generated SOAP Note</h2>
              </div>
              {[
                { key: 'subjective', label: 'S — Subjective', color: 'text-blue-400' },
                { key: 'objective', label: 'O — Objective', color: 'text-purple-400' },
                { key: 'assessment', label: 'A — Assessment', color: 'text-amber-400' },
                { key: 'plan', label: 'P — Plan', color: 'text-emerald-400' },
              ].map(({ key, label, color }) => soapNotes[key] && (
                <div key={key}>
                  <p className={`text-xs font-semibold ${color} mb-1`}>{label}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{soapNotes[key]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Prescription */}
      {activeTab === 'prescription' && (
        <div className="space-y-4">
          {/* Diagnosis input */}
          <div className="glass-card rounded-2xl p-6 border border-slate-700/50 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Pill className="w-5 h-5 text-amber-400" />
              <h2 className="font-semibold text-white">AI Prescription Generator</h2>
            </div>
            <input
              id="diagnosis-input"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Enter diagnosis (e.g. Community-acquired pneumonia)"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
            <button onClick={generateRx} disabled={!diagnosis.trim() || rxLoading}
              id="generate-rx-btn"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              {rxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {rxLoading ? 'Generating...' : 'Generate Prescription'}
            </button>
          </div>

          {/* Medicine list */}
          {medicines.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Medicines ({medicines.length})</h3>
                <button onClick={checkInteractions} disabled={drugLoading}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center gap-1.5">
                  {drugLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                  Check Interactions
                </button>
              </div>

              {/* Drug interaction result */}
              {drugCheckResult && (
                <div className={`p-3 rounded-xl border text-sm ${
                  drugCheckResult.has_interactions
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-green-500/10 border-green-500/30 text-green-300'
                }`}>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    {drugCheckResult.has_interactions ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {drugCheckResult.has_interactions ? 'Interactions Detected' : 'No Interactions Found'}
                  </div>
                  <p className="text-xs opacity-80">{drugCheckResult.overall_recommendation}</p>
                </div>
              )}

              <div className="space-y-3">
                {medicines.map((m: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                    <Pill className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{m.name} <span className="text-slate-400 font-normal">{m.dosage}</span></p>
                      <p className="text-xs text-slate-400">{m.frequency} • {m.duration}</p>
                      {m.instructions && <p className="text-xs text-slate-500 italic">{m.instructions}</p>}
                    </div>
                    <button onClick={() => setMedicines(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                id="save-prescription-btn"
                onClick={() => savePrescriptionMutation.mutate()}
                disabled={savePrescriptionMutation.isPending || !diagnosis}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                {savePrescriptionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {savePrescriptionMutation.isPending ? 'Saving...' : 'Save & Send to Pharmacy'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
