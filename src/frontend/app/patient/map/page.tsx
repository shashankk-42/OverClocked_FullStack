'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Navigation, Bed, Stethoscope, Info, ArrowRight, Loader2, X } from 'lucide-react';
import { appointmentsApi, enhancementsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const DEFAULT_FLOORS = [
  { id: '2', name: '2nd Floor', description: 'ICU & Specialized Care', zones: [] as Zone[] },
  { id: '1', name: '1st Floor', description: 'General Wards & OPD', zones: [] as Zone[] },
  { id: 'G', name: 'Ground Floor', description: 'Emergency, Reception & Pharmacy', zones: [] as Zone[] },
];

const DEPT_FLOOR_MAP: Record<string, string> = {
  Cardiology: '1',
  Orthopedics: '1',
  Neurology: '2',
  Pediatrics: '2',
  Emergency: 'G',
  'General Medicine': '1',
  Dermatology: '1',
  Radiology: 'G',
};

type Zone = {
  id: string;
  name: string;
  type: 'public' | 'department' | 'ward' | 'critical';
  floorId?: string;
  doctors?: { name: string; spec: string }[];
  rooms?: string[];
};

function zoneStyles(type: Zone['type'], selected: boolean) {
  const base =
    'group relative flex min-h-[148px] cursor-pointer flex-col justify-between rounded-xl border p-5 transition-colors duration-200';
  const palette: Record<Zone['type'], string> = {
    public: 'bg-neutral-50 text-neutral-900',
    department: 'bg-white text-neutral-900',
    ward: 'bg-blue-50/60 text-neutral-900',
    critical: 'bg-neutral-900 text-white border-neutral-900',
  };
  const selectedStyle = selected
    ? 'border-neutral-900 shadow-md ring-1 ring-neutral-900/10'
    : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm';
  return cn(base, palette[type], selectedStyle);
}

export default function HospitalMapPage() {
  const [activeFloorId, setActiveFloorId] = useState('G');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [docsRes, roomsRes] = await Promise.all([
          appointmentsApi.getDoctors(),
          enhancementsApi.roomAvailability(),
        ].map((p) => p.catch(() => null)));

        const fetchedDoctors = docsRes?.data || [];
        let fetchedRooms = roomsRes?.data?.rooms || [];

        if (!fetchedRooms.length) {
          const publicRes = await enhancementsApi.publicRoomAvailability().catch(() => null);
          if (publicRes?.data) fetchedRooms = publicRes.data;
        }

        const newFloors: typeof DEFAULT_FLOORS = JSON.parse(JSON.stringify(DEFAULT_FLOORS));

        const roomGroups: Record<string, Zone> = {};
        fetchedRooms.forEach((room: any) => {
          let fId = room.floor ? room.floor.toString().toUpperCase() : '1';
          if (fId === 'GROUND' || fId === '0') fId = 'G';
          if (!newFloors.find((f) => f.id === fId)) fId = '1';

          const zoneKey = `${fId}-${room.ward || room.room_type || 'General'}`;
          if (!roomGroups[zoneKey]) {
            roomGroups[zoneKey] = {
              id: zoneKey,
              name: room.ward || `${room.room_type} Ward`,
              type: room.room_type?.toLowerCase().includes('icu') ? 'critical' : 'ward',
              floorId: fId,
              rooms: [],
            };
          }
          roomGroups[zoneKey].rooms!.push(room.room_number);
        });

        const docGroups: Record<string, Zone> = {};
        fetchedDoctors.forEach((doc: any) => {
          const dept = doc.department || 'General Medicine';
          const fId = DEPT_FLOOR_MAP[dept] || '1';
          const zoneKey = `${fId}-dept-${dept}`;
          if (!docGroups[zoneKey]) {
            docGroups[zoneKey] = {
              id: zoneKey,
              name: `${dept} Dept.`,
              type: 'department',
              floorId: fId,
              doctors: [],
            };
          }
          docGroups[zoneKey].doctors!.push({ name: doc.name, spec: doc.specialization });
        });

        const ground = newFloors.find((f) => f.id === 'G');
        if (ground) {
          ground.zones.push(
            { id: 'zg-2', name: 'Main Reception', type: 'public' },
            { id: 'zg-3', name: 'Pharmacy', type: 'public' },
            { id: 'zg-4', name: 'Cafeteria', type: 'public' },
          );
        }

        Object.values(roomGroups).forEach((z) => {
          const f = newFloors.find((floor) => floor.id === z.floorId);
          if (f) f.zones.push(z);
        });
        Object.values(docGroups).forEach((z) => {
          const f = newFloors.find((floor) => floor.id === z.floorId);
          if (f) f.zones.push(z);
        });

        setFloors(newFloors);
      } catch (err) {
        console.error('Failed to load map data', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeFloor = useMemo(
    () => floors.find((f) => f.id === activeFloorId) || floors[2],
    [activeFloorId, floors],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { floor: (typeof floors)[0]; zone: Zone; matchedDoctors?: Zone['doctors']; matchedRooms?: string[] }[] = [];

    floors.forEach((floor) => {
      floor.zones.forEach((zone) => {
        let matched = zone.name.toLowerCase().includes(query);
        const matchedDoctors = zone.doctors?.filter(
          (d) => d.name.toLowerCase().includes(query) || d.spec.toLowerCase().includes(query),
        );
        const matchedRooms = zone.rooms?.filter((r) => r.toLowerCase().includes(query));
        if (matchedDoctors?.length) matched = true;
        if (matchedRooms?.length) matched = true;
        if (matched) results.push({ floor, zone, matchedDoctors, matchedRooms });
      });
    });

    return results;
  }, [searchQuery, floors]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-neutral-500">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
        <p>Loading hospital layout from database...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="app-card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2">
            <MapPin className="h-6 w-6 shrink-0 text-blue-600" />
            Hospital Directory & Map
          </h1>
          <p className="page-subtitle">Live data from the hospital database.</p>
        </div>

        <div className="relative w-full shrink-0 lg:w-[22rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search doctors, rooms, depts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full border-b border-neutral-100 p-3 text-left transition hover:bg-neutral-50"
                  onClick={() => {
                    setActiveFloorId(res.floor.id);
                    setSelectedZone(res.zone);
                    setSearchQuery('');
                  }}
                >
                  <div className="font-medium text-neutral-900">{res.zone.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
                    <Navigation className="h-3 w-3" /> {res.floor.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Floor picker */}
        <div className="app-card h-fit p-3">
          <h2 className="mb-3 px-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Select Floor</h2>
          <div className="space-y-1.5">
            {floors.map((floor) => {
              const active = activeFloorId === floor.id;
              return (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => {
                    setActiveFloorId(floor.id);
                    setSelectedZone(null);
                  }}
                  className={cn(
                    'w-full rounded-lg px-3 py-3 text-left transition-colors',
                    active
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100',
                  )}
                >
                  <div className="text-sm font-semibold">{floor.name}</div>
                  <div className={cn('mt-0.5 text-xs leading-snug', active ? 'text-neutral-300' : 'text-neutral-500')}>
                    {floor.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map grid */}
        <div className="space-y-4">
          <div className="app-card overflow-hidden">
            <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">
              <h2 className="text-lg font-bold text-neutral-900">{activeFloor.name}</h2>
              <p className="text-sm text-neutral-500">{activeFloor.description}</p>
            </div>

            <div className="bg-neutral-50/80 p-4 sm:p-5">
              {activeFloor.zones.length === 0 ? (
                <div className="py-16 text-center text-sm text-neutral-500">
                  No departments or rooms found on this floor.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {activeFloor.zones.map((zone) => {
                    const selected = selectedZone?.id === zone.id;
                    const isDark = zone.type === 'critical';
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => setSelectedZone(zone)}
                        className={zoneStyles(zone.type, selected)}
                      >
                        <div className="text-left">
                          <h3 className="text-base font-semibold leading-tight">{zone.name}</h3>
                          {zone.doctors && (
                            <p className={cn('mt-2 flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-neutral-300' : 'text-neutral-600')}>
                              <Stethoscope className="h-3.5 w-3.5" /> {zone.doctors.length} doctor(s)
                            </p>
                          )}
                          {zone.rooms && (
                            <p className={cn('mt-1 flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-neutral-300' : 'text-neutral-600')}>
                              <Bed className="h-3.5 w-3.5" /> {zone.rooms.length} room(s)
                            </p>
                          )}
                        </div>
                        <ArrowRight className={cn('absolute bottom-4 right-4 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100', selected && 'opacity-70', isDark ? 'text-white' : 'text-neutral-400')} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedZone && (
            <div className="app-card p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">{selectedZone.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                    <MapPin className="h-4 w-4" /> Located on {activeFloor.name}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  {selectedZone.type.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                {selectedZone.doctors && selectedZone.doctors.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <Stethoscope className="h-4 w-4 text-blue-600" /> Doctors on duty
                    </h4>
                    <div className="space-y-2">
                      {selectedZone.doctors.map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-neutral-700 ring-1 ring-neutral-200">
                            {doc.name.split(' ')[1]?.[0] || doc.name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">{doc.name}</p>
                            <p className="truncate text-sm text-neutral-500">{doc.spec}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedZone.rooms && selectedZone.rooms.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <Bed className="h-4 w-4 text-blue-600" /> Rooms in this zone
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedZone.rooms.map((room, i) => (
                        <span key={i} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700">
                          {room}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(!selectedZone.doctors || selectedZone.doctors.length === 0) &&
                  (!selectedZone.rooms || selectedZone.rooms.length === 0) && (
                    <div className="col-span-full flex flex-col items-center py-8 text-center text-sm text-neutral-500">
                      <Info className="mb-2 h-8 w-8 text-neutral-300" />
                      No specific room or doctor information available for this zone.
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
