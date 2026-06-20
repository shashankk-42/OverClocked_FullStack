'use client';

import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi, navigationApi } from '@/lib/api';
import { ArrowUpDown, Bed, Building2, ChevronRight, Cross, FlaskConical, Loader2, MapPin, Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Location = {
  id: string;
  code: string;
  name: string;
  location_type: string;
  department?: string | null;
  floor: number;
  room_number?: string | null;
  x: number;
  y: number;
  is_restricted?: boolean;
};

type RouteResponse = {
  path: Location[];
  estimated_minutes: number;
  floor_changes: number;
};

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  reception: Users,
  waiting: Users,
  billing: Building2,
  pharmacy: Cross,
  emergency: Cross,
  opd: StethoscopeIcon,
  doctor_cabin: StethoscopeIcon,
  lab: FlaskConical,
  radiology: FlaskConical,
  imaging: FlaskConical,
  icu: Cross,
  ward: Bed,
  elevator: Building2,
  stairs: ArrowUpDown,
  restroom: Users,
};

function StethoscopeIcon({ className }: { className?: string }) {
  return <MapPin className={className} />;
}

function locationStyle(location: Location, highlighted: boolean, selected: boolean) {
  if (selected) return 'border-neutral-900 bg-neutral-900 text-white shadow-md z-20';
  if (highlighted) return 'border-neutral-500 bg-neutral-800 text-white shadow-sm z-10';
  if (location.is_restricted) return 'border-neutral-300 bg-neutral-100 text-neutral-500';
  return 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-500 hover:shadow-sm hover:z-10';
}

export function HospitalNavigationMap({ mode = 'patient' }: { mode?: 'patient' | 'reception' }) {
  const [floor, setFloor] = useState(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Location | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const { data: floorData = [], isLoading } = useQuery({
    queryKey: ['navigation-floors'],
    queryFn: () => navigationApi.floors().then((res) => res.data),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['patient-navigation-appointments'],
    queryFn: () => appointmentsApi.myAppointments().then((res) => res.data),
    enabled: mode === 'patient',
  });

  const nextAppointment = useMemo(
    () =>
      appointments
        .filter((appt: any) => ['booked', 'checked_in', 'waiting', 'in_consultation'].includes(appt.status))
        .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0],
    [appointments]
  );

  const floors = floorData.map((item: { floor: number }) => item.floor);
  const locations: Location[] = floorData.find((item: { floor: number }) => item.floor === floor)?.locations || [];
  const allLocations: Location[] = floorData.flatMap((item: { locations: Location[] }) => item.locations || []);

  const filtered = allLocations.filter((location) => {
    const value = `${location.name} ${location.department || ''} ${location.room_number || ''} ${location.location_type}`.toLowerCase();
    return value.includes(query.toLowerCase());
  });
  const pathCodes = new Set((route?.path || []).map((location) => location.code));

  const findRoute = async (location: Location) => {
    setSelected(location);
    setFloor(location.floor);
    setRouteLoading(true);
    try {
      const res = await navigationApi.route(location.code, 'reception');
      setRoute(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Route not found');
      setRoute(null);
    } finally {
      setRouteLoading(false);
    }
  };

  const loadAppointmentRoute = async () => {
    if (!nextAppointment) return;
    setRouteLoading(true);
    try {
      const locRes = await navigationApi.appointmentLocation(nextAppointment.id);
      const location = locRes.data.location as Location | null;
      if (!location) {
        toast.error('Appointment location is not assigned yet');
        return;
      }
      await findRoute(location);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not load appointment route');
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Hospital Navigation</p>
          <h1 className="text-2xl font-bold text-neutral-900">Floor Map & Shortest Route</h1>
          <p className="mt-1 text-sm text-neutral-500">Search a department, choose a floor, and route from reception.</p>
        </div>
        {mode === 'patient' && nextAppointment && (
          <button
            onClick={loadAppointmentRoute}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            <MapPin className="h-4 w-4" />
            Current Appointment: {format(new Date(nextAppointment.scheduled_at), 'h:mm a')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,340px)_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">Destination</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search room, lab, pharmacy..."
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              />
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {(query ? filtered : allLocations).slice(0, 30).map((location) => (
                <button
                  key={location.code}
                  onClick={() => findRoute(location)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition ${
                    selected?.code === location.code
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-neutral-900">{location.name}</span>
                    <span className="text-xs text-neutral-500">
                      Floor {location.floor}{location.room_number ? ` | Room ${location.room_number}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold text-neutral-900">Route</h2>
            {routeLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating shortest route...
              </div>
            ) : route ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-neutral-100 border border-neutral-200 p-3 text-neutral-800">
                    <p className="text-xl font-bold">{route.estimated_minutes}</p>
                    <p className="text-xs text-neutral-500">minutes</p>
                  </div>
                  <div className="rounded-xl bg-neutral-100 border border-neutral-200 p-3 text-neutral-800">
                    <p className="text-xl font-bold">{route.floor_changes}</p>
                    <p className="text-xs text-neutral-500">floor changes</p>
                  </div>
                </div>
                <ol className="space-y-2">
                  {route.path.map((location, index) => (
                    <li key={`${location.code}-${index}`} className="flex gap-2 text-sm">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <button onClick={() => setFloor(location.floor)} className="text-left">
                        <span className="block font-medium text-neutral-900">{location.name}</span>
                        <span className="text-xs text-neutral-500">Floor {location.floor}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Choose a destination to see the route.</p>
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {floors.map((item: number) => (
                <button
                  key={item}
                  onClick={() => setFloor(item)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    floor === item
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  Floor {item}
                </button>
              ))}
            </div>
            <p className="text-sm text-neutral-500">{locations.length} mapped locations</p>
          </div>

          {isLoading ? (
            <div className="flex h-[min(560px,70vh)] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="relative w-full" style={{ paddingBottom: '62%' }}>
              <div className="absolute inset-0 overflow-hidden rounded-xl border border-neutral-200 bg-[linear-gradient(to_bottom,#fafafa_0%,#f5f5f5_100%)]">
                {/* Corridor guide lines */}
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-neutral-300" />
                <div className="pointer-events-none absolute inset-y-8 left-1/2 w-px -translate-x-1/2 bg-neutral-300" />
                {locations.map((location) => {
                  const Icon = TYPE_ICON[location.location_type] || MapPin;
                  const highlighted = pathCodes.has(location.code);
                  const isSelected = selected?.code === location.code;
                  return (
                    <button
                      key={location.code}
                      onClick={() => findRoute(location)}
                      title={location.name}
                      style={{ left: `${location.x}%`, top: `${location.y}%` }}
                      className={`group absolute w-[6rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-1.5 text-left text-[10px] leading-tight transition-all duration-150 ${locationStyle(location, highlighted, isSelected)}`}
                    >
                      <Icon className="mb-0.5 h-3 w-3 flex-shrink-0" />
                      <span className="block truncate font-semibold">{location.name}</span>
                      <span className="block truncate opacity-70">
                        {location.room_number || location.location_type.replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
