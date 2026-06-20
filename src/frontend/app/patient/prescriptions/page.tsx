'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi, pharmacyApi } from '@/lib/api';
import { format } from 'date-fns';
import {
  Building2, CheckCircle2, CreditCard, Loader2, Pill, Store, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const STATUS_TEXT: Record<string, string> = {
  patient_review: 'Choose pickup option',
  pending: 'Sent to pharmacy',
  preparing: 'Being prepared',
  ready_for_pickup: 'Packed — pay to collect',
  paid: 'Paid — collect medicines',
  fulfilled: 'Collected',
  declined_hospital: 'External pickup',
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PatientPrescriptionsPage() {
  const queryClient = useQueryClient();
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['patient-pharmacy-orders'],
    queryFn: () => pharmacyApi.orders().then((res) => res.data),
    refetchInterval: 15000,
  });

  const { data: config } = useQuery({
    queryKey: ['billing-config'],
    queryFn: () => billingApi.config().then((r) => r.data),
  });

  const pickupMutation = useMutation({
    mutationFn: ({ orderId, collect }: { orderId: string; collect: boolean }) =>
      pharmacyApi.pickupChoice(orderId, collect),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['patient-pharmacy-orders'] });
      if (vars.collect) {
        toast.success('Sent to hospital pharmacy for preparation');
      } else {
        toast.success('You can use this prescription at an external pharmacy');
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not save your choice'),
  });

  const payPharmacyBill = async (order: any) => {
    const billId = order.bill?.id;
    if (!billId) {
      toast.error('Bill not ready yet');
      return;
    }
    if (!config?.enabled) {
      toast.error('Payment gateway is not configured');
      return;
    }

    setPayingOrderId(order.id);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Could not load Razorpay checkout');
        return;
      }

      const orderRes = await billingApi.createOrder(billId);
      const rzOrder = orderRes.data;

      await new Promise<void>((resolve, reject) => {
        const options = {
          key: rzOrder.key_id || config.key_id,
          amount: rzOrder.amount,
          currency: rzOrder.currency || 'INR',
          name: 'MediFlow AI',
          description: 'Hospital pharmacy medicines',
          order_id: rzOrder.id,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await billingApi.verifyPayment({
                bill_id: billId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success('Payment successful! Collect your medicines from the pharmacy counter.');
              queryClient.invalidateQueries({ queryKey: ['patient-pharmacy-orders'] });
              queryClient.invalidateQueries({ queryKey: ['patient-bills'] });
              resolve();
            } catch (err: any) {
              toast.error(err.response?.data?.detail || 'Payment verification failed');
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          theme: { color: '#059669' },
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          toast.error(resp.error?.description || 'Payment failed');
          reject(new Error('Payment failed'));
        });
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message !== 'Payment cancelled') {
        toast.error(err?.response?.data?.detail || err?.message || 'Payment failed');
      }
    } finally {
      setPayingOrderId(null);
    }
  };

  const busy = pickupMutation.isPending || payingOrderId !== null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Prescriptions</p>
        <h1 className="text-2xl font-bold text-neutral-900">My Prescriptions</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Review prescriptions from your doctor and choose hospital pharmacy pickup.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center rounded-2xl border border-neutral-200 bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <Pill className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="font-semibold text-neutral-900">No prescriptions yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Finalized prescriptions from your doctor will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">{order.doctor_name}</p>
                  <p className="mt-1 text-sm text-neutral-600">{order.diagnosis || 'No diagnosis recorded'}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}
                  </p>
                </div>
                <span className={`status-${order.status} w-fit rounded-full border px-3 py-1 text-xs font-medium`}>
                  {STATUS_TEXT[order.status] || order.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {order.medicines?.map((medicine: any, index: number) => (
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

              {order.status === 'patient_review' && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="text-sm font-semibold text-neutral-900">
                    Collect from hospital pharmacy?
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    If yes, our pharmacy will prepare your medicines and send a payment link when packed.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => pickupMutation.mutate({ orderId: order.id, collect: true })}
                      disabled={busy}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {pickupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      Yes, hospital pharmacy
                    </button>
                    <button
                      onClick={() => pickupMutation.mutate({ orderId: order.id, collect: false })}
                      disabled={busy}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Store className="h-4 w-4" />
                      No, external pharmacy
                    </button>
                  </div>
                </div>
              )}

              {order.status === 'declined_hospital' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  <XCircle className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                  You chose external pickup. Download or show this prescription at your preferred pharmacy.
                </div>
              )}

              {order.status === 'ready_for_pickup' && order.bill?.payment_status === 'pending' && (
                <div className="mt-4 space-y-3">
                  {order.bill.payment_link_sent_at ? (
                    <p className="text-xs text-emerald-700">
                      Payment link received — pay ₹{Number(order.bill.total_amount).toFixed(2)} to collect.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      Medicines packed. Waiting for pharmacy to send payment link…
                    </p>
                  )}
                  {order.bill.payment_link_sent_at && (
                    <button
                      onClick={() => payPharmacyBill(order)}
                      disabled={payingOrderId === order.id}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {payingOrderId === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Pay ₹{Number(order.bill.total_amount).toFixed(2)} via Razorpay
                    </button>
                  )}
                </div>
              )}

              {order.status === 'paid' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Payment complete — collect your medicines from the hospital pharmacy counter.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
