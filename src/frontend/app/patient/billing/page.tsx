'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { format } from 'date-fns';
import { CreditCard, Loader2, CheckCircle2, AlertCircle, IndianRupee, Pill, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type BillItem = {
  description?: string;
  medicine_name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
};

type Bill = {
  id: string;
  total_amount: number;
  subtotal: number;
  tax: number;
  payment_status: string;
  bill_type: string;
  title?: string;
  source_label?: string;
  doctor_name?: string;
  medicine_names?: string[];
  medicine_count?: number;
  items?: BillItem[];
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

function billTitle(bill: Bill): string {
  if (bill.title) return bill.title;
  if (bill.bill_type === 'pharmacy') return 'Hospital pharmacy medicines';
  return bill.items?.[0]?.description || 'Consultation fee';
}

function razorpayDescription(bill: Bill): string {
  if (bill.bill_type === 'pharmacy') {
    const count = bill.medicine_count || bill.medicine_names?.length || bill.items?.length || 0;
    return count ? `Pharmacy medicines (${count} items)` : 'Hospital pharmacy invoice';
  }
  return bill.items?.[0]?.description || 'Consultation fee';
}

function BillCard({
  bill,
  highlighted,
  config,
  payingBillId,
  methodByBill,
  setMethodByBill,
  payBill,
  offlinePaymentMutation,
}: {
  bill: Bill;
  highlighted: boolean;
  config: { enabled?: boolean; key_id?: string } | undefined;
  payingBillId: string | null;
  methodByBill: Record<string, string>;
  setMethodByBill: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  payBill: (bill: Bill) => Promise<void>;
  offlinePaymentMutation: ReturnType<typeof useMutation<any, any, { billId: string; method: string }>>;
}) {
  const isPharmacy = bill.bill_type === 'pharmacy';
  const awaitingLink = isPharmacy && !bill.payment_link_sent_at;
  const canPay = !awaitingLink;

  return (
    <div
      id={`bill-${bill.id}`}
      className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
        highlighted ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-neutral-200'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isPharmacy ? (
              <Pill className="h-5 w-5 flex-shrink-0 text-amber-600" />
            ) : (
              <Stethoscope className="h-5 w-5 flex-shrink-0 text-emerald-600" />
            )}
            <p className="font-semibold text-neutral-900">{billTitle(bill)}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                isPharmacy
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {isPharmacy ? 'Pharmacy' : 'Consultation'}
            </span>
          </div>

          {bill.doctor_name && (
            <p className="mt-1 text-sm text-neutral-500">
              {isPharmacy ? 'Prescribed by' : 'Doctor'}: {bill.doctor_name}
            </p>
          )}

          {isPharmacy && (bill.medicine_names?.length || bill.items?.length) ? (
            <ul className="mt-3 space-y-1 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              {(bill.items?.length
                ? bill.items
                : (bill.medicine_names || []).map((name) => ({ medicine_name: name } as BillItem))
              ).map((item, index) => (
                  <li key={`${item.medicine_name || item.description || index}-${index}`} className="flex justify-between gap-2">
                    <span>{item.medicine_name || item.description}</span>
                    {item.quantity != null && (
                      <span className="text-xs text-neutral-500">×{item.quantity}</span>
                    )}
                  </li>
                ))}
            </ul>
          ) : null}

          <p className="mt-2 text-xs text-neutral-400">
            Issued {format(new Date(bill.created_at), 'dd MMM yyyy, h:mm a')}
          </p>

          {bill.payment_link_sent_at && (
            <p className="mt-1 text-xs text-blue-600">
              {isPharmacy
                ? 'Payment link received from hospital pharmacy'
                : 'Payment link received from your doctor'}
            </p>
          )}

          {awaitingLink && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Medicines packed — pharmacy will send the payment link shortly.
            </p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="flex items-center justify-end gap-1 text-2xl font-bold text-neutral-900">
            <IndianRupee className="h-5 w-5" />
            {bill.total_amount.toFixed(2)}
          </p>
          <p className="text-xs text-neutral-500">
            Subtotal ₹{bill.subtotal.toFixed(2)} + tax ₹{bill.tax.toFixed(2)}
          </p>
        </div>
      </div>

      {canPay ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <select
              value={methodByBill[bill.id] || 'upi'}
              onChange={(event) => setMethodByBill((prev) => ({ ...prev, [bill.id]: event.target.value }))}
              className="app-input"
            >
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="simulated">Simulated</option>
            </select>
            <button
              id={`pay-offline-${bill.id}`}
              onClick={() =>
                offlinePaymentMutation.mutate({ billId: bill.id, method: methodByBill[bill.id] || 'upi' })
              }
              disabled={offlinePaymentMutation.isPending}
              className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {offlinePaymentMutation.isPending ? 'Processing...' : 'Pay'}
            </button>
          </div>

          {config?.enabled && (
            <button
              onClick={() => payBill(bill)}
              disabled={payingBillId === bill.id}
              className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {payingBillId === bill.id ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay...
                </span>
              ) : (
                'Pay Now with Razorpay'
              )}
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function PatientBillingPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const highlightBillId = searchParams.get('bill');
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [methodByBill, setMethodByBill] = useState<Record<string, string>>({});

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['patient-bills'],
    queryFn: () => billingApi.myBills().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: config } = useQuery({
    queryKey: ['billing-config'],
    queryFn: () => billingApi.config().then((r) => r.data),
  });

  const consultationBills = useMemo(
    () => bills.filter((b: Bill) => b.bill_type !== 'pharmacy'),
    [bills]
  );
  const pharmacyBills = useMemo(
    () => bills.filter((b: Bill) => b.bill_type === 'pharmacy'),
    [bills]
  );

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
          description: razorpayDescription(bill),
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
              toast.success(
                bill.bill_type === 'pharmacy'
                  ? 'Pharmacy payment successful! Collect your medicines at the counter.'
                  : 'Payment successful!'
              );
              queryClient.invalidateQueries({ queryKey: ['patient-bills'] });
              queryClient.invalidateQueries({ queryKey: ['patient-pharmacy-orders'] });
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

  const offlinePaymentMutation = useMutation({
    mutationFn: ({ billId, method }: { billId: string; method: string }) => billingApi.payBill(billId, method),
    onSuccess: (res) => {
      toast.success(`Payment recorded. Receipt ${res.data.transaction_id}`);
      queryClient.invalidateQueries({ queryKey: ['patient-bills'] });
      queryClient.invalidateQueries({ queryKey: ['patient-pharmacy-orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Payment failed'),
  });

  const cardProps = {
    config,
    payingBillId,
    methodByBill,
    setMethodByBill,
    payBill,
    offlinePaymentMutation,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Payments</p>
        <h1 className="text-2xl font-bold text-neutral-900">Billing & Payments</h1>
        <p className="mt-1 text-neutral-500">
          Pay consultation and pharmacy invoices, then receive a stored receipt.
        </p>
      </div>

      {!config?.enabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          Razorpay test keys are not configured. You can still complete local payments with UPI, card, cash, or simulated mode.
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
          <p className="mt-1 text-sm text-neutral-500">
            Consultation fees and pharmacy invoices will appear here when payment is due.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {consultationBills.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                <Stethoscope className="h-4 w-4" /> Consultation
              </h2>
              {consultationBills.map((bill: Bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  highlighted={bill.id === highlightBillId}
                  {...cardProps}
                />
              ))}
            </section>
          )}

          {pharmacyBills.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                <Pill className="h-4 w-4" /> Pharmacy
              </h2>
              {pharmacyBills.map((bill: Bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  highlighted={bill.id === highlightBillId}
                  {...cardProps}
                />
              ))}
            </section>
          )}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
        Test mode: use UPI <span className="font-mono">success@razorpay</span> or card{' '}
        <span className="font-mono">5267 3181 8797 5449</span> with any future expiry and CVV.
      </div>
    </div>
  );
}
