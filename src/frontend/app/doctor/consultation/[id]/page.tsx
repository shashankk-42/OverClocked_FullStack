'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { consultationsApi, aiApi, getUploadsBaseUrl } from '@/lib/api';
import { format } from 'date-fns';
import { Brain, FileText, Pill, AlertTriangle, Loader2, CheckCircle2, Trash2, Download, Plus, LogOut } from 'lucide-react';
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
  const [savedPrescriptionId, setSavedPrescriptionId] = useState<string | null>(null);
  const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(null);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: 'once daily', duration: '5 days', instructions: '' });

  useEffect(() => {
    if (!diagnosis && soapNotes?.assessment && soapNotes.assessment !== 'Diagnosis pending') {
      setDiagnosis(soapNotes.assessment);
    }
  }, [soapNotes, diagnosis]);

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
    if (!diagnosis.trim()) {
      toast.error('Enter a diagnosis first');
      return;
    }
    setRxLoading(true);
    try {
      const res = await aiApi.generatePrescription(diagnosis, patientId);
      const suggested = res.data.medicines || [];
      if (suggested.length === 0) {
        toast.error('No medicines returned. Add medicines manually below.');
      } else {
        setMedicines(suggested);
        toast.success(
          res.data.source === 'offline'
            ? 'Suggested medicines added (offline clinical template)'
            : 'Prescription suggestions generated!'
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate prescription');
    } finally {
      setRxLoading(false);
    }
  };

  const addManualMedicine = () => {
    if (!newMed.name.trim() || !newMed.dosage.trim()) {
      toast.error('Medicine name and dosage are required');
      return;
    }
    setMedicines((prev) => [...prev, { ...newMed, form: 'tablet', quantity: 10 }]);
    setNewMed({ name: '', dosage: '', frequency: 'once daily', duration: '5 days', instructions: '' });
  };

  const addPreviousMedicine = (medicine: any) => {
    if (!medicine?.name) return;
    setMedicines((prev) => {
      if (prev.some((item: any) => item.name?.toLowerCase() === medicine.name.toLowerCase())) return prev;
      return [...prev, { ...medicine, quantity: medicine.quantity || 10 }];
    });
    toast.success(`${medicine.name} added to prescription`);
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
    onSuccess: (res) => {
      setSavedPrescriptionId(res.data.id);
      if (res.data.pdf_url) {
        setSavedPdfUrl(`${getUploadsBaseUrl()}${res.data.pdf_url}`);
      }
      toast.success('Prescription finalized — patient will choose pharmacy pickup');
      setTimeout(() => router.push('/doctor/dashboard'), 1500);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to save prescription');
    },
  });

  const downloadPdf = async () => {
    if (!savedPrescriptionId) return;
    try {
      const res = await consultationsApi.downloadPrescriptionPdf(savedPrescriptionId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription-${savedPrescriptionId.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      if (savedPdfUrl) window.open(savedPdfUrl, '_blank');
      else toast.error('Could not download PDF');
    }
  };

  const canSave = !!diagnosis.trim() && medicines.length > 0 && !savedPrescriptionId && !!patientId && !!appointmentId;
  const summary = summaryData?.summary;
  const context = summaryData?.context;

  const RISK_COLOR: Record<string, string> = {
    low: 'text-green-700 bg-green-50 border border-green-200',
    moderate: 'text-yellow-700 bg-yellow-50 border border-yellow-200',
    high: 'text-red-700 bg-red-50 border border-red-200',
    unknown: 'text-neutral-500 bg-neutral-100 border border-neutral-200',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Consultation</h1>
          <p className="text-neutral-500 text-sm">Patient: <span className="text-blue-600 font-mono">{pid}</span></p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Back to queue
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 border border-neutral-200 rounded-xl w-fit">
        {(['summary', 'notes', 'prescription'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-lg font-medium capitalize transition-all
              ${activeTab === tab ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {tab === 'notes' ? 'SOAP Notes' : tab === 'prescription' ? 'Prescription' : 'Patient Summary'}
          </button>
        ))}
      </div>

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {summaryLoading ? (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 text-blue-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>AI is analyzing patient history...</span>
              </div>
            </div>
          ) : summary ? (
            <>
              {/* AI Summary */}
              <div className="bg-white rounded-2xl p-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    <h2 className="font-semibold text-neutral-900">AI Clinical Summary</h2>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_COLOR[summary.risk_level] || RISK_COLOR.unknown}`}>
                    {summary.risk_level?.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-neutral-700 text-sm leading-relaxed mb-4">{summary.summary}</p>

                <div className="grid grid-cols-2 gap-4">
                  {summary.active_conditions?.length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2 font-medium uppercase">Active Conditions</p>
                      <div className="space-y-1">
                        {summary.active_conditions.map((c: string) => (
                          <div key={c} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-orange-500" />
                            <span className="text-xs text-neutral-700">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.key_alerts?.length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 mb-2 font-medium uppercase">⚠ Key Alerts</p>
                      <div className="space-y-1">
                        {summary.key_alerts.map((alert: string) => (
                          <div key={alert} className="flex items-start gap-2">
                            <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-amber-700">{alert}</span>
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
                  <div key={label} className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                    <p className="text-xs text-neutral-500">{label}</p>
                    <p className="text-sm font-medium text-neutral-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Recent prescriptions from history */}
              {historyData?.prescriptions?.slice(0, 2).map((rx: any) => (
                <div key={rx.id} className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm">
                  <p className="text-xs text-neutral-500 mb-1">{format(new Date(rx.created_at), 'dd MMM yyyy')} — {rx.doctor_name}</p>
                  <p className="text-sm font-medium text-neutral-900">{rx.diagnosis}</p>
                  <p className="text-xs text-neutral-500">{rx.medicines?.length || 0} medicines prescribed</p>
                </div>
              ))}
            </>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center border border-neutral-200 shadow-sm">
              <p className="text-neutral-500">No history found for this patient</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: SOAP Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-neutral-900">AI SOAP Note Generator</h2>
            </div>
            <p className="text-sm text-neutral-500">Type or dictate your consultation notes. AI will structure them into SOAP format.</p>
            <textarea
              id="soap-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Patient presents with 3-day history of fever (102°F), productive cough, and mild shortness of breath. On examination: BP 120/80, Pulse 98, SpO2 96%..."
              rows={6}
              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-sm resize-none"
            />
            <button onClick={generateSoap} disabled={!transcript.trim() || notesLoading}
              id="generate-soap-btn"
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              {notesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {notesLoading ? 'Generating SOAP Notes...' : 'Generate SOAP Notes'}
            </button>
          </div>

          {soapNotes && (
            <div className="bg-white rounded-2xl p-6 border border-emerald-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-neutral-900">Generated SOAP Note</h2>
              </div>
              {[
                { key: 'subjective', label: 'S — Subjective', color: 'text-blue-600' },
                { key: 'objective', label: 'O — Objective', color: 'text-purple-600' },
                { key: 'assessment', label: 'A — Assessment', color: 'text-amber-600' },
                { key: 'plan', label: 'P — Plan', color: 'text-emerald-600' },
              ].map(({ key, label, color }) => soapNotes[key] && (
                <div key={key}>
                  <p className={`text-xs font-semibold ${color} mb-1`}>{label}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{soapNotes[key]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Prescription */}
      {activeTab === 'prescription' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="font-semibold text-neutral-900">Prescription & Close Visit</h2>
                <p className="text-sm text-neutral-500">Enter diagnosis, add medicines, then save to generate PDF, close appointment, and notify patient for payment.</p>
              </div>
            </div>

            {soapNotes && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                SOAP notes attached. Assessment: {soapNotes.assessment || '—'}
              </div>
            )}

            {context?.allergies && context.allergies !== 'None reported' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Known allergies: {context.allergies}
              </div>
            )}

            <div>
              <label htmlFor="diagnosis-input" className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Diagnosis</label>
              <input
                id="diagnosis-input"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute viral upper respiratory infection"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              onClick={generateRx}
              disabled={!diagnosis.trim() || rxLoading}
              id="generate-rx-btn"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {rxLoading ? 'Suggesting medicines...' : 'Suggest Medicines with AI'}
            </button>

            {historyData?.prescriptions?.some((rx: any) => rx.medicines?.length > 0) && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Previous medicines</p>
                <div className="flex flex-wrap gap-2">
                  {historyData.prescriptions
                    .flatMap((rx: any) => rx.medicines || [])
                    .slice(0, 8)
                    .map((medicine: any, index: number) => (
                      <button
                        key={`${medicine.name}-${index}`}
                        onClick={() => addPreviousMedicine(medicine)}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400"
                      >
                        {medicine.name} {medicine.dosage ? `(${medicine.dosage})` : ''}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Medicines ({medicines.length})</h3>
              {medicines.length > 0 && (
                <button onClick={checkInteractions} disabled={drugLoading}
                  className="text-xs px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg flex items-center gap-1.5">
                  {drugLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                  Check Interactions
                </button>
              )}
            </div>

            {drugCheckResult && (
              <div className={`p-3 rounded-xl border text-sm ${
                drugCheckResult.has_interactions
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                <div className="flex items-center gap-2 font-medium mb-1">
                  {drugCheckResult.has_interactions ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {drugCheckResult.has_interactions ? 'Interactions Detected' : 'No Interactions Found'}
                </div>
                <p className="text-xs opacity-80">{drugCheckResult.overall_recommendation}</p>
              </div>
            )}

            {medicines.length === 0 ? (
              <p className="text-sm text-neutral-500">No medicines yet. Use AI suggest above or add manually below.</p>
            ) : (
              <div className="space-y-3">
                {medicines.map((m: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <Pill className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">{m.name} <span className="font-normal text-neutral-500">{m.dosage}</span></p>
                      <p className="text-xs text-neutral-500">{m.frequency} • {m.duration}</p>
                      {m.instructions && <p className="text-xs italic text-neutral-600">{m.instructions}</p>}
                    </div>
                    <button onClick={() => setMedicines((prev) => prev.filter((_, idx) => idx !== i))} className="text-neutral-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-neutral-300 p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Add medicine manually</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="Medicine name" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                <input value={newMed.dosage} onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} placeholder="Dosage (e.g. 500mg)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                <input value={newMed.frequency} onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })} placeholder="Frequency" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                <input value={newMed.duration} onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })} placeholder="Duration" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <button onClick={addManualMedicine} className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800">
                <Plus className="h-3.5 w-3.5" /> Add Medicine
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-emerald-900">Complete Consultation</h3>
            <p className="text-sm text-emerald-800">
              Locks this prescription, saves the final version, marks the consultation completed, and sends it to the patient for pharmacy approval.
            </p>

            <button
              id="finish-prescription-btn"
              onClick={() => savePrescriptionMutation.mutate()}
              disabled={!canSave || savePrescriptionMutation.isPending}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savePrescriptionMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Finishing prescription...</>
              ) : savedPrescriptionId ? (
                <><CheckCircle2 className="h-4 w-4" /> Visit Completed</>
              ) : (
                <><LogOut className="h-4 w-4" /> Finish Prescription</>
              )}
            </button>

            {!diagnosis.trim() && (
              <p className="text-xs text-amber-700">Enter a diagnosis to enable save.</p>
            )}
            {diagnosis.trim() && medicines.length === 0 && (
              <p className="text-xs text-amber-700">Add at least one medicine to finish the prescription.</p>
            )}

            {savedPrescriptionId && (
              <button
                onClick={downloadPdf}
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:underline"
              >
                <Download className="h-4 w-4" /> Download prescription PDF
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
