'use client';

import Link from 'next/link';
import { useState } from 'react';
import { patientsApi } from '@/lib/api';
import { Loader2, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';

export default function DoctorPatientSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await patientsApi.search(query.trim());
      setResults(res.data);
    } catch {
      toast.error('Patient search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Patient Search</h1>
        <p className="page-subtitle">Find a patient by PID, name, or phone before opening clinical history.</p>
      </div>

      <div className="app-card p-5">
        <div className="flex gap-3">
          <input
            id="doctor-patient-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && runSearch()}
            placeholder="Search PID, name, or phone"
            className="app-input flex-1"
          />
          <button id="doctor-search-btn" onClick={runSearch} className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {results.map((patient) => (
          <Link
            key={patient.id}
            href={`/doctor/patient/${patient.pid}?patientId=${patient.id}`}
            className="app-card flex items-center justify-between p-4 transition hover:border-blue-300"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <UserRound className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{patient.name}</p>
                <p className="text-xs font-mono text-neutral-500">{patient.pid} | {patient.phone}</p>
              </div>
            </div>
            <span className="text-sm text-neutral-500">{patient.gender || 'Unknown'} | {patient.blood_group || 'No blood group'}</span>
          </Link>
        ))}
        {query && !loading && results.length === 0 ? <p className="text-sm text-neutral-500">No patients found yet.</p> : null}
      </div>
    </div>
  );
}
