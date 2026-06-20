'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { format } from 'date-fns';
import { CreditCard, Loader2, CheckCircle2, AlertCircle, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Bill = {
  id: string;
  total_amount: number;
  subtotal: number;
  tax: number;
  payment_status: string;
  bill_type: string;
  doctor_name?: string;
  items?: { description?: string }[];
  created_at: string;
  payment_link_sent_at?: string | null;
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

export default function PatientBillingPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const highlightBillId = searchParams.get('bill');
  const [payingBillId, setPayingBillId] = useState<string | null>(null);

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['patient-bills'],
    queryFn: () => billingApi.myBills().then((r) => r.data),
  });

  const { data: config } = useQuery({
    queryKey: ['billing-config'],
    queryFn: () => billingApi.config().then((r) => r.data),
  });

  useEffect(() => {
    if (highlightBillId && bills.length > 0) {
      const el = document.getElementById(`bill-${highlightBillId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightBillId, bills]);

  const payBill = async (bill: Bill) => {
    if (!config?.enabled) {
      toast.error('Payment gateway is not configured on the server.');
      return;
    }

    setPayingBillId(bill.id);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Could not load Razorpay checkout.');
        return;
      }

      const orderRes = await billingApi.createOrder(bill.id);
      const order = orderRes.data;

      await new Promise<void>((resolve, reject) => {
        const options = {
          key: order.key_id || config.key_id,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'MediFlow AI',
          description: bill.items?.[0]?.description || 'Consultation fee',
          order_id: order.id,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await billingApi.verifyPayment({
                bill_id: bill.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success('Payment successful!');
              queryClient.invalidateQueries({ queryKey: ['patient-bills'] });
              resolve();
            } catch (err: any) {
              toast.error(err.response?.data?.detail || 'Payment verification failed');
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
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
        toast.error(err.response?.data?.detail || err.message || 'Payment could not be started');
      }
    } finally {
      setPayingBillId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Payments</p>
        <h1 className="text-2xl font-bold text-neutral-900">Consultation Billing</h1>
        <p className="mt-1 text-neutral-500">Pay pending consultation fees after your doctor completes the visit.</p>
      </div>

      {!config?.enabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          Razorpay test keys are not configured on the backend. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable live checkout.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : bills.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <p className="font-semibold text-neutral-900">No pending payments</p>
          <p className="mt-1 text-sm text-neutral-500">When your doctor completes a consultation, the payment request will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bills.map((bill: Bill) => {
            const highlighted = bill.id === highlightBillId;
            return (
              <div
                key={bill.id}
                id={`bill-${bill.id}`}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                  highlighted ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-neutral-200'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                      <p className="font-semibold text-neutral-900">
                        {bill.items?.[0]?.description || 'Consultation fee'}
                      </p>
                    </div>
                    {bill.doctor_name && (
                      <p className="mt-1 text-sm text-neutral-500">Doctor: {bill.doctor_name}</p>
                    )}
                    <p className="mt-1 text-xs text-neutral-400">
                      Issued {format(new Date(bill.created_at), 'dd MMM yyyy, h:mm a')}
                    </p>
                    {bill.payment_link_sent_at && (
                      <p className="mt-1 text-xs text-blue-600">Payment link received from your doctor</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1 text-2xl font-bold text-neutral-900">
                      <IndianRupee className="h-5 w-5" />
                      {bill.total_amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Subtotal ₹{bill.subtotal.toFixed(2)} + tax ₹{bill.tax.toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => payBill(bill)}
                  disabled={payingBillId === bill.id || !config?.enabled}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {payingBillId === bill.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay...
                    </span>
                  ) : (
                    'Pay Now with Razorpay'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
        Test mode: use UPI <span className="font-mono">success@razorpay</span> or card{' '}
        <span className="font-mono">5267 3181 8797 5449</span> with any future expiry and CVV.
      </div>
    </div>
  );
}
