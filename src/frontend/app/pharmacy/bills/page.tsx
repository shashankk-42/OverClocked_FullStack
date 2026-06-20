'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '@/lib/api';
import { format } from 'date-fns';
import { CheckCircle, CreditCard, Loader2, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';

export default function PharmacyBillsPage() {
  const queryClient = useQueryClient();
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['pharmacy-bills'],
    queryFn: () => pharmacyApi.bills().then((res) => res.data),
  });

  const payMutation = useMutation({
    mutationFn: (billId: string) => pharmacyApi.pay(billId, 'simulated'),
    onSuccess: () => {
      toast.success('Bill marked paid');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-bills'] });
    },
  });

  const pendingTotal = bills.filter((bill: any) => bill.payment_status === 'pending').reduce((sum: number, bill: any) => sum + Number(bill.total_amount), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Simulated pharmacy bill payments and receipts.</p>
        </div>
        <div className="app-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Pending collection</p>
          <p className="text-xl font-bold text-neutral-900">Rs {pendingTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-4">
          <ReceiptText className="h-5 w-5 text-blue-600" />
          <p className="font-semibold text-neutral-900">{bills.length} bills</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-500" /></div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {bills.map((bill: any) => (
              <div key={bill.id} className="grid grid-cols-1 gap-4 p-5 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                <div>
                  <p className="font-semibold text-neutral-900">{bill.patient_name}</p>
                  <p className="font-mono text-xs text-neutral-500">{bill.patient_pid} | {format(new Date(bill.created_at), 'dd MMM yyyy, h:mm a')}</p>
                  <p className="mt-1 text-xs text-neutral-500">{bill.items?.length || 0} billed medicine lines</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">Rs {Number(bill.total_amount).toFixed(2)}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs status-${bill.payment_status}`}>{bill.payment_status}</span>
                </div>
                {bill.payment_status === 'pending' ? (
                  <button onClick={() => payMutation.mutate(bill.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
                    <CreditCard className="h-4 w-4" /> Mark Paid
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm text-emerald-700"><CheckCircle className="h-4 w-4" /> Paid</span>
                )}
              </div>
            ))}
            {bills.length === 0 ? <p className="p-8 text-center text-sm text-neutral-500">No bills yet. Dispense a prescription to create one.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
