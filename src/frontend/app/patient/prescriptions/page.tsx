'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '@/lib/api';
import { format } from 'date-fns';
import { CheckCircle2, CreditCard, Loader2, Pill } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_TEXT: Record<string, string> = {
  patient_review: 'Review medicines',
  pending: 'Sent to pharmacy',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
};

export default function PatientPrescriptionsPage() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['patient-pharmacy-orders'],
    queryFn: () => pharmacyApi.orders().then((res) => res.data),
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: (orderId: string) => pharmacyApi.approveOrder(orderId),
    onSuccess: () => {
      toast.success('Medicines approved and sent to pharmacy');
      queryClient.invalidateQueries({ queryKey: ['patient-pharmacy-orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Could not approve medicines'),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Prescription Review</p>
        <h1 className="text-2xl font-bold text-neutral-900">My Prescriptions</h1>
        <p className="mt-1 text-sm text-neutral-500">Approve medicines before they enter the pharmacy fulfillment queue.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center rounded-2xl border border-neutral-200 bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <Pill className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="font-semibold text-neutral-900">No prescriptions to review</p>
          <p className="mt-1 text-sm text-neutral-500">Finalized prescriptions from your doctor will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">{order.doctor_name}</p>
                  <p className="mt-1 text-sm text-neutral-600">{order.diagnosis || 'No diagnosis recorded'}</p>
                  <p className="mt-1 text-xs text-neutral-500">{format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}</p>
                </div>
                <span className={`status-${order.status} rounded-full border px-3 py-1 text-xs font-medium`}>
                  {STATUS_TEXT[order.status] || order.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {order.medicines?.map((medicine: any, index: number) => (
                  <div key={`${medicine.name}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="font-semibold text-neutral-900">{medicine.name} <span className="font-normal text-neutral-500">{medicine.dosage}</span></p>
                    <p className="text-sm text-neutral-500">{medicine.frequency} | {medicine.duration}</p>
                    {medicine.instructions && <p className="mt-1 text-xs text-neutral-600">{medicine.instructions}</p>}
                  </div>
                ))}
              </div>

              {order.status === 'patient_review' && (
                <button
                  id={`approve-order-${order.id}`}
                  onClick={() => approveMutation.mutate(order.id)}
                  disabled={approveMutation.isPending}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve Medicines
                </button>
              )}

              {order.status === 'ready_for_pickup' && order.bill?.payment_status === 'pending' && (
                <Link href="/patient/billing" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white hover:bg-neutral-800">
                  <CreditCard className="h-4 w-4" /> Pay Pharmacy Bill
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
