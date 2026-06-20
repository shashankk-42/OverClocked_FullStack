'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Loader2, Package, Search, ShieldCheck } from 'lucide-react';
import { pharmacyApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface InventoryItem {
  id: string;
  medicine_name: string;
  generic_name?: string | null;
  category?: string | null;
  stock: number;
  unit: string;
  price_per_unit: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
}

export default function PharmacyInventoryPage() {
  const [query, setQuery] = useState('');

  const { data: inventory = [], isLoading, isError } = useQuery<InventoryItem[]>({
    queryKey: ['pharmacy-inventory'],
    queryFn: () => pharmacyApi.inventory().then((res) => res.data),
    refetchInterval: 30000,
  });

  const filteredInventory = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return inventory;

    return inventory.filter((item) =>
      [item.medicine_name, item.generic_name, item.category]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle))
    );
  }, [inventory, query]);

  const lowStockCount = inventory.filter((item) => item.is_low_stock).length;
  const totalUnits = inventory.reduce((sum, item) => sum + item.stock, 0);
  const inventoryValue = inventory.reduce(
    (sum, item) => sum + item.stock * Number(item.price_per_unit),
    0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Track stock levels, pricing, and low-stock alerts.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            id="inventory-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search medicine, generic, category"
            className="h-10 border-neutral-300 bg-white pl-9 text-neutral-900 placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">SKUs</p>
              <p className="text-2xl font-bold text-neutral-900">{inventory.length}</p>
            </div>
          </div>
        </div>

        <div className="app-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Units In Stock</p>
              <p className="text-2xl font-bold text-neutral-900">{totalUnits.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div className="app-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Low Stock</p>
              <p className="text-2xl font-bold text-neutral-900">{lowStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Stock Ledger</h2>
            <p className="text-xs text-neutral-500">
              Estimated value: Rs {inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading inventory
          </div>
        ) : isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
            <p className="font-medium text-neutral-900">Inventory could not be loaded</p>
            <p className="mt-1 text-sm text-neutral-500">Check backend connectivity and pharmacist access.</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Package className="mb-3 h-10 w-10 text-neutral-300" />
            <p className="font-medium text-neutral-900">No medicines found</p>
            <p className="mt-1 text-sm text-neutral-500">Try another search term.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-200 hover:bg-transparent">
                <TableHead className="px-4 text-neutral-500">Medicine</TableHead>
                <TableHead className="text-neutral-500">Category</TableHead>
                <TableHead className="text-right text-neutral-500">Stock</TableHead>
                <TableHead className="text-right text-neutral-500">Threshold</TableHead>
                <TableHead className="text-right text-neutral-500">Price</TableHead>
                <TableHead className="px-4 text-right text-neutral-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.id} className="border-neutral-100 hover:bg-neutral-50">
                  <TableCell className="px-4">
                    <p className="font-medium text-neutral-900">{item.medicine_name}</p>
                    <p className="text-xs text-neutral-500">{item.generic_name || 'Generic not listed'}</p>
                  </TableCell>
                  <TableCell className="text-neutral-700">{item.category || 'General'}</TableCell>
                  <TableCell className="text-right font-mono text-neutral-900">
                    {item.stock.toLocaleString('en-IN')} {item.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono text-neutral-500">
                    {item.low_stock_threshold.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right font-mono text-neutral-900">
                    Rs {Number(item.price_per_unit).toFixed(2)}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <span
                      className={
                        item.is_low_stock
                          ? 'inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200'
                          : 'inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200'
                      }
                    >
                      {item.is_low_stock ? 'Low stock' : 'Available'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
