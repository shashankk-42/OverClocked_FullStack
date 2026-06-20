'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi, aiApi } from '@/lib/api';
import { format } from 'date-fns';
import { Pill, CheckCircle2, Loader2, Brain, AlertTriangle, DollarSign, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function PharmacyDashboard() {
  const queryClient = useQueryClient();
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [currentBill, setCurrentBill] = useState<any>(null);
  const [altMedicines, setAltMedicines] = useState<Record<string, any[]>>({});
  const [altLoading, setAltLoading] = useState<Record<string, boolean>>({});

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['pharmacy-pending'],
    queryFn: () => pharmacyApi.pendingPrescriptions().then((r) => r.data),
    refetchInterval: 20000,
  });

  const dispenseMutation = useMutation({
    mutationFn: (prescriptionId: string) => pharmacyApi.dispense(prescriptionId),
    onSuccess: (data) => {
      setCurrentBill(data.data);
      setDispensingId(null);
      queryClient.invalidateQueries({ queryKey: ['pharmacy-pending'] });
      toast.success('Prescription dispensed! Bill created.');
    },
    onError: (err: any) => {
      setDispensingId(null);
      toast.error(err.response?.data?.detail || 'Dispensing failed');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (billId: string) => pharmacyApi.pay(billId, 'simulated'),
    onSuccess: () => {
      toast.success('Payment received! Receipt generated.');
      setCurrentBill(null);
      setSelectedRx(null);
    },
    onError: () => toast.error('Payment failed'),
  });

  const getAltMedicines = async (medicine: string, diagnosis: string) => {
    setAltLoading((prev) => ({ ...prev, [medicine]: true }));
    try {
      const res = await aiApi.altMedicine(medicine, diagnosis || 'General');
      setAltMedicines((prev) => ({ ...prev, [medicine]: res.data.alternatives }));
    } catch {
      toast.error('Failed to get alternatives');
    } finally {
      setAltLoading((prev) => ({ ...prev, [medicine]: false }));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pharmacy Dashboard</h1>
          <p className="text-slate-400 text-sm">Pending prescriptions: {prescriptions.length}</p>
        </div>
        <div className="glass-card rounded-xl px-4 py-3 border border-amber-500/20">
          <p className="text-2xl font-bold text-amber-400">{prescriptions.length}</p>
          <p className="text-xs text-slate-500">Pending Rx</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Prescriptions List */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Pill className="w-4 h-4 text-amber-400" /> Prescription Queue
          </h2>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}</div>
          ) : prescriptions.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center border border-slate-700/50">
              <Pill className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No pending prescriptions</p>
              <p className="text-slate-600 text-sm mt-1">Queue is clear</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx: any) => (
                <button key={rx.id}
                  onClick={() => { setSelectedRx(rx); setCurrentBill(null); }}
                  className={`w-full text-left glass-card rounded-xl p-4 border transition-all
                    ${selectedRx?.id === rx.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-700/50 hover:border-slate-600'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{rx.patient_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{rx.patient_pid}</p>
                      <p className="text-xs text-slate-400 mt-1">{rx.diagnosis || 'No diagnosis'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-0.5 rounded-full status-pending border">pending</span>
                      <p className="text-xs text-slate-500 mt-1">{rx.medicines?.length || 0} meds</p>
                      <p className="text-xs text-slate-600">{format(new Date(rx.created_at), 'h:mm a')}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Prescription Detail */}
        <div>
          {selectedRx && !currentBill && (
            <div className="glass-card rounded-2xl p-6 border border-amber-500/20 space-y-4">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-amber-400" />
                <h2 className="font-semibold text-white">Prescription Detail</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500 text-xs">Patient</p><p className="text-white font-medium">{selectedRx.patient_name}</p></div>
                <div><p className="text-slate-500 text-xs">Doctor</p><p className="text-white">{selectedRx.doctor_name}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs">Diagnosis</p><p className="text-white">{selectedRx.diagnosis}</p></div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Medicines</p>
                {selectedRx.medicines?.map((m: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{m.name} <span className="text-slate-400">{m.dosage}</span></p>
                        <p className="text-xs text-slate-400">{m.frequency} • {m.duration}</p>
                        <p className="text-xs text-slate-500">{m.instructions}</p>
                      </div>
                      <button
                        onClick={() => getAltMedicines(m.name, selectedRx.diagnosis)}
                        disabled={altLoading[m.name]}
                        className="text-xs px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg flex items-center gap-1 hover:bg-blue-500/20 transition-all">
                        {altLoading[m.name] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                        Alt
                      </button>
                    </div>

                    {/* Alternative medicines */}
                    {altMedicines[m.name] && altMedicines[m.name].length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-xs text-blue-400 mb-1.5">AI Alternatives:</p>
                        {altMedicines[m.name].map((alt: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 text-xs p-2 bg-blue-500/5 rounded-lg mb-1">
                            <Brain className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-blue-300 font-medium">{alt.name}</span>
                              <span className="text-slate-400"> — {alt.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                id={`dispense-btn-${selectedRx.id}`}
                onClick={() => { setDispensingId(selectedRx.id); dispenseMutation.mutate(selectedRx.id); }}
                disabled={dispenseMutation.isPending}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                {dispenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {dispenseMutation.isPending ? 'Dispensing...' : 'Dispense All Medicines'}
              </button>
            </div>
          )}

          {/* Bill */}
          {currentBill && (
            <div className="glass-card rounded-2xl p-6 border border-emerald-500/20 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Bill Generated</h2>
              </div>

              <div className="space-y-2">
                {currentBill.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-300">{item.medicine_name} × {item.quantity}</span>
                    <span className="text-white">₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-700 pt-2 mt-2">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Subtotal</span>
                    <span>₹{(currentBill.total_amount - (currentBill.total_amount * 0.05 / 1.05)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Tax (5%)</span>
                    <span>₹{(currentBill.total_amount * 0.05 / 1.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-white mt-1">
                    <span>Total</span>
                    <span>₹{Number(currentBill.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                id={`pay-btn-${currentBill.bill_id}`}
                onClick={() => paymentMutation.mutate(currentBill.bill_id)}
                disabled={paymentMutation.isPending}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                {paymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {paymentMutation.isPending ? 'Processing...' : 'Mark as Paid (₹' + Number(currentBill.total_amount).toFixed(2) + ')'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
