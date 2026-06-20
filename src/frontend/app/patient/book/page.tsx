'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { aiApi, appointmentsApi } from '@/lib/api';
import { format, addDays } from 'date-fns';
import { Brain, Loader2, Calendar, Clock, ChevronRight, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const STEPS = ['Describe Symptoms', 'AI Triage', 'Choose Doctor', 'Select Slot', 'Confirm'] as const;
type Step = (typeof STEPS)[number];

export default function BookAppointmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [symptoms, setSymptoms] = useState('');
  const [triageResult, setTriageResult] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', triageResult?.department],
    queryFn: () => appointmentsApi.getDoctors(triageResult?.department).then((r) => r.data),
    enabled: step === 2,
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', selectedDoctor?.id, selectedDate],
    queryFn: () => appointmentsApi.getSlots(selectedDoctor.id, selectedDate).then((r) => r.data),
    enabled: !!selectedDoctor && step === 3,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      appointmentsApi.book({
        doctor_id: selectedDoctor.id,
        scheduled_at: selectedSlot,
        chief_complaint: symptoms,
        priority: triageResult?.priority || 'medium',
        triage_department: triageResult?.department,
      }),
    onSuccess: () => {
      toast.success('Appointment booked successfully!');
      router.push('/patient/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Booking failed');
    },
  });

  const runTriage = async () => {
    if (!symptoms.trim()) return;
    setTriageLoading(true);
    try {
      const res = await aiApi.triage(symptoms);
      setTriageResult(res.data);
      setStep(2);
    } catch {
      toast.error('Triage failed. Please try again.');
    } finally {
      setTriageLoading(false);
    }
  };

  const PRIORITY_COLORS: Record<string, string> = {
    emergency: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    low: 'text-green-400 bg-green-500/10 border-green-500/30',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Book Appointment</h1>
        <p className="text-slate-400 mt-1">AI-powered symptom triage + smart scheduling</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
              ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 transition-all ${i < step ? 'bg-emerald-500' : 'bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm font-medium text-blue-400">{STEPS[step]}</p>

      {/* Step 0: Describe Symptoms */}
      {step === 0 && (
        <div className="glass-card rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Describe Your Symptoms</h2>
          </div>
          <p className="text-slate-400 text-sm">Tell us what you're experiencing in plain language. Our AI will recommend the right department.</p>
          <textarea
            id="symptoms-input"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. I have had a severe headache for 3 days with neck stiffness and light sensitivity..."
            rows={5}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {['Fever and cough', 'Chest pain', 'Back pain', 'Headache', 'Skin rash', 'Joint pain'].map((s) => (
              <button key={s} onClick={() => setSymptoms(s)}
                className="text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors">
                {s}
              </button>
            ))}
          </div>
          <button
            id="run-triage-btn"
            onClick={runTriage}
            disabled={!symptoms.trim() || triageLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all">
            {triageLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {triageLoading ? 'AI is analyzing...' : 'Analyze with AI Triage'}
          </button>
        </div>
      )}

      {/* Step 1: Triage Result (shown before going to step 2) */}
      {step === 1 && triageResult && (
        <div className="glass-card rounded-2xl p-6 border border-blue-500/20 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">AI Triage Result</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Recommended Department</p>
              <p className="text-lg font-bold text-white">{triageResult.department}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Priority</p>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full border ${PRIORITY_COLORS[triageResult.priority]}`}>
                {triageResult.priority?.toUpperCase()}
              </span>
            </div>
          </div>
          {triageResult.reasoning && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs text-blue-400 font-medium mb-1">AI Reasoning</p>
              <p className="text-sm text-slate-300">{triageResult.reasoning}</p>
            </div>
          )}
          {triageResult.do_not_delay && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">This may require urgent attention. Please seek immediate care.</p>
            </div>
          )}
          <button onClick={() => setStep(2)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
            Find Available Doctors <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Choose Doctor */}
      {step === 2 && (
        <div className="glass-card rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="font-semibold text-white">Select a Doctor</h2>
          {triageResult && (
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Brain className="w-3 h-3 text-blue-400" />
              AI recommended: <span className="text-blue-400 font-medium">{triageResult.department}</span>
            </div>
          )}
          <div className="space-y-3">
            {doctors.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No doctors found in this department</p>
            ) : doctors.map((doc: any) => (
              <button key={doc.id} onClick={() => { setSelectedDoctor(doc); setStep(3); }}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left
                  ${selectedDoctor?.id === doc.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'}`}>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold">
                  {doc.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-white">{doc.name}</p>
                  <p className="text-sm text-slate-400">{doc.specialization}</p>
                  <p className="text-xs text-slate-500">{doc.department} • Available: {doc.available_days || 'Mon-Fri'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 ml-auto self-center" />
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-white">← Back to triage</button>
        </div>
      )}

      {/* Step 3: Select Slot */}
      {step === 3 && selectedDoctor && (
        <div className="glass-card rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="font-semibold text-white">Select Date & Time</h2>
          <p className="text-sm text-slate-400">With {selectedDoctor.name}</p>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Select Date</label>
            <input type="date" value={selectedDate}
              min={format(new Date(), 'yyyy-MM-dd')}
              max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm" />
          </div>

          {slotsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading available slots...
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-400 mb-3">Available Time Slots</p>
              <div className="grid grid-cols-4 gap-2">
                {(slotsData?.slots || []).map((slot: string) => (
                  <button key={slot} onClick={() => setSelectedSlot(slot)}
                    className={`py-2 text-xs rounded-lg border transition-all font-medium
                      ${selectedSlot === slot ? 'bg-blue-500 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}>
                    {format(new Date(slot), 'h:mm a')}
                  </button>
                ))}
                {(slotsData?.slots || []).length === 0 && (
                  <p className="col-span-4 text-slate-500 text-sm">No slots available for this date. Try another day.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">← Back</button>
            <button onClick={() => setStep(4)} disabled={!selectedSlot}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && selectedDoctor && selectedSlot && (
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/20 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white">Confirm Appointment</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Doctor', value: selectedDoctor.name },
              { label: 'Department', value: selectedDoctor.department },
              { label: 'Date & Time', value: format(new Date(selectedSlot), 'EEEE, dd MMM yyyy — h:mm a') },
              { label: 'Priority', value: triageResult?.priority?.toUpperCase() || 'MEDIUM' },
              { label: 'Symptoms', value: symptoms },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4 text-sm">
                <span className="text-slate-500 w-28 flex-shrink-0">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">← Edit</button>
            <button
              id="confirm-booking-btn"
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              {bookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {bookMutation.isPending ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
