'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '@/lib/api';
import { format } from 'date-fns';
import { CheckCircle2, Clock, IndianRupee, Loader2, Package, Pill, Send } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready_for_pickup: 'Packed',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
};

const STATUS_TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'incoming', label: 'Incoming', statuses: ['pending'] },
  { key: 'preparing', label: 'Preparing', statuses: ['preparing'] },
  { key: 'ready_for_pickup', label: 'Packed', statuses: ['ready_for_pickup'] },
  { key: 'paid', label: 'Paid', statuses: ['paid'] },
  { key: 'fulfilled', label: 'Fulfilled', statuses: ['fulfilled'] },
];

const NEXT_ACTION: Record<string, { label: string; next: string }> = {
  pending: { label: 'Start Preparing', next: 'preparing' },
  preparing: { label: 'Mark Packed', next: 'ready_for_pickup' },
  paid: { label: 'Mark Fulfilled', next: 'fulfilled' },
};

type PharmacyOrder = {
  id: string;
  patient_name: string;
  patient_pid: string;
  doctor_name: string;
  diagnosis?: string;
  medicines: any[];
  status: string;
  bill?: {
    id: string;
    total_amount: number;
    payment_status: string;
    payment_link_sent_at?: string | null;
    items: any[];
  } | null;
  created_at: string;
};

export default function PharmacyDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('incoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['pharmacy-orders'],
    queryFn: () => pharmacyApi.orders().then((res) => res.data),
    refetchInterval: 15000,
  });

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    STATUS_TABS.forEach((tab) => {
      result[tab.key] = orders.filter((order: PharmacyOrder) =>
        tab.statuses.includes(order.status)
      ).length;
    });
    return result;
  }, [orders]);

  const activeTabConfig = STATUS_TABS.find((tab) => tab.key === activeTab) || STATUS_TABS[0];
  const filtered = orders.filter((order: PharmacyOrder) =>
    activeTabConfig.statuses.includes(order.status)
  );
  const selected = filtered.find((order: PharmacyOrder) => order.id === selectedId) || filtered[0] || null;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => pharmacyApi.updateOrderStatus(id, status),
    onSuccess: (_data, vars) => {
      if (vars.status === 'ready_for_pickup') {
        toast.success('Order marked packed — send payment link to patient');
      } else {
        toast.success('Order updated');
      }
      queryClient.invalidateQueries({ queryKey: ['pharmacy-orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not update order'),
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: (orderId: string) => pharmacyApi.sendPaymentLink(orderId),
    onSuccess: (res) => {
      toast.success(`Payment link sent — ₹${Number(res.data.amount).toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ['pharmacy-orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not send payment link'),
  });

  const busy = updateStatusMutation.isPending || sendPaymentLinkMutation.isPending;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Pharmacy Workspace</p>
          <h1 className="text-2xl font-bold text-neutral-900">Prescription Fulfillment Queue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Orders appear after the patient chooses hospital pharmacy pickup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedId(null);
              }}
              className={`min-w-[88px] rounded-xl border px-4 py-3 text-center shadow-sm transition ${
                activeTab === tab.key
                  ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-100'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <p className="text-xl font-bold text-neutral-900">{counts[tab.key] || 0}</p>
              <p className="text-xs text-neutral-500">{tab.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            <Pill className="h-4 w-4 text-amber-600" />
            {activeTabConfig.label} Orders
          </h2>
          {isLoading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
              <Package className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
              <p className="font-semibold text-neutral-900">No {activeTabConfig.label.toLowerCase()} orders</p>
              <p className="mt-1 text-sm text-neutral-500">The queue is clear for this stage.</p>
            </div>
          ) : (
            filtered.map((order: PharmacyOrder) => (
              <button
                key={order.id}
                onClick={() => setSelectedId(order.id)}
                className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition ${
                  selected?.id === order.id
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{order.patient_name}</p>
                    <p className="font-mono text-xs text-neutral-500">{order.patient_pid}</p>
                    <p className="mt-1 truncate text-xs text-neutral-500">{order.doctor_name}</p>
                  </div>
                  <span className={`status-${order.status} flex-shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>{order.medicines?.length || 0} medicines</span>
                  <span>{format(new Date(order.created_at), 'dd MMM, h:mm a')}</span>
                </div>
              </button>
            ))
          )}
        </section>

        <section className="min-h-[480px]">
          {selected ? (
            <div className="h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-neutral-900">{selected.patient_name}</h2>
                  <p className="text-sm text-neutral-500">{selected.doctor_name}</p>
                  <p className="mt-2 text-sm text-neutral-700">{selected.diagnosis || 'No diagnosis recorded'}</p>
                </div>
                {selected.bill && (
                  <div className="flex-shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                    <p className="flex items-center gap-1 text-xl font-bold">
                      <IndianRupee className="h-4 w-4" /> {Number(selected.bill.total_amount).toFixed(2)}
                    </p>
                    <p className="text-xs capitalize">{selected.bill.payment_status}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-3">
                {selected.medicines?.map((medicine: any, index: number) => (
                  <div key={`${medicine.name}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="font-semibold text-neutral-900">
                      {medicine.name}{' '}
                      <span className="font-normal text-neutral-500">{medicine.dosage}</span>
                    </p>
                    <p className="text-sm text-neutral-500">
                      {medicine.frequency} | {medicine.duration}
                    </p>
                    {medicine.instructions && (
                      <p className="mt-1 text-xs text-neutral-600">{medicine.instructions}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {NEXT_ACTION[selected.status] && (
                  <button
                    id={`pharmacy-action-${selected.id}`}
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selected.id,
                        status: NEXT_ACTION[selected.status].next,
                      })
                    }
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {NEXT_ACTION[selected.status].label}
                  </button>
                )}

                {selected.status === 'ready_for_pickup' && selected.bill?.payment_status === 'pending' && (
                  <button
                    onClick={() => sendPaymentLinkMutation.mutate(selected.id)}
                    disabled={busy || !!selected.bill.payment_link_sent_at}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {sendPaymentLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {selected.bill.payment_link_sent_at
                      ? 'Payment link sent'
                      : 'Send Payment Link'}
                  </button>
                )}

                {selected.status === 'ready_for_pickup' && !selected.bill?.payment_link_sent_at && (
                  <p className="text-center text-xs text-neutral-500">
                    Mark packed first, then send the Razorpay payment link to the patient.
                  </p>
                )}

                {selected.status === 'ready_for_pickup' && selected.bill?.payment_link_sent_at && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-semibold text-blue-700">
                    <Clock className="h-4 w-4" /> Waiting for patient payment
                  </div>
                )}

                {selected.status === 'fulfilled' && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Order complete
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
              <Pill className="mb-3 h-10 w-10 text-neutral-300" />
              <p className="font-semibold text-neutral-900">Select an order</p>
              <p className="mt-1 text-sm text-neutral-500">Order details and actions appear here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
