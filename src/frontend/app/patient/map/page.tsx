'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bed,
  Building2,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { appointmentsApi, navigationApi } from '@/lib/api';
import { cn } from '@/lib/utils';

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

type FloorData = {
  floor: number;
  locations: Location[];
};

type Doctor = {
  id?: string;
  name: string;
  department?: string | null;
  specialization?: string | null;
};

type RouteResponse = {
  path: Location[];
  estimated_minutes: number;
  floor_changes: number;
};

const TYPE_LABELS: Record<string, string> = {
  reception: 'Reception',
  waiting: 'Waiting Area',
  billing: 'Billing',
  pharmacy: 'Pharmacy',
  emergency: 'Emergency',
  opd: 'OPD',
  doctor_cabin: 'Doctor Cabin',
  lab: 'Lab',
  radiology: 'Radiology',
  imaging: 'Imaging',
  icu: 'ICU',
  ward: 'Ward',
  elevator: 'Elevator',
  stairs: 'Stairs',
  restroom: 'Restroom',
};

function floorName(floor: number) {
  if (floor === 0) return 'Ground Floor';
  if (floor === 1) return '1st Floor';
  if (floor === 2) return '2nd Floor';
  if (floor === 3) return '3rd Floor';
  return `Floor ${floor}`;
}

function floorDescription(locations: Location[]) {
  const departments = Array.from(new Set(locations.map((item) => item.department).filter(Boolean)));
  if (departments.length) return departments.slice(0, 3).join(', ');
  return `${locations.length} mapped hospital location${locations.length === 1 ? '' : 's'}`;
}

function locationTypeLabel(type: string) {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

function locationCardStyle(location: Location, selected: boolean, inRoute: boolean) {
  if (selected) return 'border-neutral-900 bg-neutral-900 text-white shadow-md ring-1 ring-neutral-900/10';
  if (inRoute) return 'border-blue-300 bg-blue-50 text-neutral-900 shadow-sm';
  if (location.is_restricted) return 'border-neutral-200 bg-neutral-100 text-neutral-500';
  if (location.location_type === 'icu' || location.location_type === 'emergency') {
    return 'border-red-200 bg-red-50 text-red-950 hover:border-red-300';
  }
  if (location.location_type === 'ward') return 'border-blue-100 bg-blue-50/70 text-neutral-900 hover:border-blue-200';
  return 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:shadow-sm';
}

export default function HospitalMapPage() {
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const { data: floors = [], isLoading: floorsLoading } = useQuery({
    queryKey: ['patient-map-navigation-floors'],
    queryFn: () => navigationApi.floors().then((res) => res.data as FloorData[]),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['patient-map-doctors'],
    queryFn: () => appointmentsApi.getDoctors().then((res) => res.data as Doctor[]),
  });

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.floor - b.floor),
    [floors],
  );

  const currentFloor = activeFloor ?? sortedFloors[0]?.floor ?? 0;
  const activeFloorData = sortedFloors.find((item) => item.floor === currentFloor) || sortedFloors[0];
  const locations = activeFloorData?.locations || [];
  const allLocations = useMemo(
    () => sortedFloors.flatMap((item) => item.locations || []),
    [sortedFloors],
  );

  const doctorsByDepartment = useMemo(() => {
    return doctors.reduce<Record<string, Doctor[]>>((acc, doctor) => {
      const key = doctor.department?.toLowerCase();
      if (!key) return acc;
      acc[key] = [...(acc[key] || []), doctor];
      return acc;
    }, {});
  }, [doctors]);

  const selectedDoctors = useMemo(() => {
    const department = selectedLocation?.department?.toLowerCase();
    return department ? doctorsByDepartment[department] || [] : [];
  }, [doctorsByDepartment, selectedLocation]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return allLocations.filter((location) => {
      const locationDoctors = location.department
        ? doctorsByDepartment[location.department.toLowerCase()] || []
        : [];
      const value = [
        location.name,
        location.department,
        location.room_number,
        locationTypeLabel(location.location_type),
        ...locationDoctors.flatMap((doctor) => [doctor.name, doctor.specialization]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return value.includes(query);
    });
  }, [allLocations, doctorsByDepartment, searchQuery]);

  const routeCodes = useMemo(
    () => new Set((route?.path || []).map((location) => location.code)),
    [route],
  );

  const selectLocation = async (location: Location, calculateRoute = false) => {
    setSelectedLocation(location);
    setActiveFloor(location.floor);

    if (!calculateRoute) return;

    setRouteLoading(true);
    try {
      const res = await navigationApi.route(location.code, 'reception');
      setRoute(res.data as RouteResponse);
    } catch {
      setRoute(null);
    } finally {
      setRouteLoading(false);
    }
  };

  if (floorsLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-neutral-500">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
        <p>Loading hospital layout from reception navigation...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="app-card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2">
            <MapPin className="h-6 w-6 shrink-0 text-blue-600" />
            Hospital Directory & Map
          </h1>
          <p className="page-subtitle">Live room, department, and route data from reception navigation.</p>
        </div>

        <div className="relative w-full shrink-0 lg:w-[24rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search doctors, rooms, departments..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="app-input pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {searchQuery && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
              <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Search Results
              </div>
              {searchResults.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className="w-full border-b border-neutral-100 p-3 text-left transition hover:bg-neutral-50"
                  onClick={() => {
                    void selectLocation(location, true);
                    setSearchQuery('');
                  }}
                >
                  <div className="font-medium text-neutral-900">{location.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
                    <Navigation className="h-3 w-3" />
                    {floorName(location.floor)}
                    {location.room_number ? ` / Room ${location.room_number}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="app-card h-fit p-3">
          <h2 className="mb-3 px-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Select Floor</h2>
          <div className="space-y-1.5">
            {sortedFloors.map((floor) => {
              const active = currentFloor === floor.floor;
              return (
                <button
                  key={floor.floor}
                  type="button"
                  onClick={() => {
                    setActiveFloor(floor.floor);
                    setSelectedLocation(null);
                  }}
                  className={cn(
                    'w-full rounded-lg px-3 py-3 text-left transition-colors',
                    active ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100',
                  )}
                >
                  <div className="text-sm font-semibold">{floorName(floor.floor)}</div>
                  <div className={cn('mt-0.5 text-xs leading-snug', active ? 'text-neutral-300' : 'text-neutral-500')}>
                    {floorDescription(floor.locations)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="app-card overflow-hidden">
            <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">{floorName(currentFloor)}</h2>
                  <p className="text-sm text-neutral-500">{floorDescription(locations)}</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-600">
                  <Building2 className="h-3.5 w-3.5" />
                  {locations.length} locations
                </span>
              </div>
            </div>

            <div className="bg-neutral-50/80 p-4 sm:p-5">
              {locations.length === 0 ? (
                <div className="py-16 text-center text-sm text-neutral-500">
                  No mapped rooms or departments found on this floor.
                </div>
              ) : (
                <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-neutral-200" />
                  <div className="pointer-events-none absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-neutral-200" />
                  <div className="pointer-events-none absolute left-5 top-5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-500">
                    Start: Reception
                  </div>

                  {locations.map((location) => {
                    const selected = selectedLocation?.code === location.code;
                    const inRoute = routeCodes.has(location.code);
                    return (
                      <button
                        key={location.id}
                        type="button"
                        title={location.name}
                        style={{ left: `${location.x}%`, top: `${location.y}%` }}
                        onClick={() => void selectLocation(location, true)}
                        className={cn(
                          'group absolute flex w-[7.5rem] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-3 text-left text-xs leading-tight transition-colors duration-200',
                          locationCardStyle(location, selected, inRoute),
                        )}
                      >
                        <span className="truncate text-sm font-semibold">{location.name}</span>
                        <span className={cn('mt-1 truncate', selected ? 'text-neutral-300' : 'text-neutral-500')}>
                          {location.room_number ? `Room ${location.room_number}` : locationTypeLabel(location.location_type)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedLocation && (
            <div className="app-card p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">{selectedLocation.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                    <MapPin className="h-4 w-4" />
                    {floorName(selectedLocation.floor)}
                    {selectedLocation.room_number ? ` / Room ${selectedLocation.room_number}` : ''}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  {locationTypeLabel(selectedLocation.location_type)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <Building2 className="h-4 w-4 text-blue-600" /> Department
                  </h4>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-800">
                    {selectedLocation.department || 'General hospital area'}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <Bed className="h-4 w-4 text-blue-600" /> Room
                  </h4>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-800">
                    {selectedLocation.room_number || 'No room number assigned'}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <Navigation className="h-4 w-4 text-blue-600" /> Route
                  </h4>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-800">
                    {routeLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Calculating
                      </span>
                    ) : route ? (
                      `${route.estimated_minutes} min / ${route.floor_changes} floor change${route.floor_changes === 1 ? '' : 's'}`
                    ) : (
                      'Route unavailable'
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <Stethoscope className="h-4 w-4 text-blue-600" /> Doctors in this department
                  </h4>
                  {selectedDoctors.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDoctors.map((doctor, index) => (
                        <div key={doctor.id || `${doctor.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-neutral-700 ring-1 ring-neutral-200">
                            {doctor.name.split(' ')[1]?.[0] || doctor.name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">{doctor.name}</p>
                            <p className="truncate text-sm text-neutral-500">{doctor.specialization || selectedLocation.department}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                      <Info className="h-4 w-4" />
                      No doctor roster linked to this department yet.
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <ArrowRight className="h-4 w-4 text-blue-600" /> Route steps from reception
                  </h4>
                  {route?.path?.length ? (
                    <ol className="space-y-2">
                      {route.path.map((step, index) => (
                        <li key={`${step.code}-${index}`} className="flex gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveFloor(step.floor);
                              setSelectedLocation(step);
                            }}
                            className="min-w-0 text-left"
                          >
                            <span className="block truncate font-medium text-neutral-900">{step.name}</span>
                            <span className="text-xs text-neutral-500">{floorName(step.floor)}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                      <Info className="h-4 w-4" />
                      Select a mapped room to calculate the route.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
