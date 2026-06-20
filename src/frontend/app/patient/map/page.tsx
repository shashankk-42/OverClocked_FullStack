'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Navigation, Bed, Stethoscope, Info, ArrowRight, Loader2 } from 'lucide-react';
import { appointmentsApi, enhancementsApi } from '@/lib/api';

const DEFAULT_FLOORS = [
  { id: '2', name: '2nd Floor', description: 'ICU & Specialized Care', zones: [] as any[] },
  { id: '1', name: '1st Floor', description: 'General Wards & OPD', zones: [] as any[] },
  { id: 'G', name: 'Ground Floor', description: 'Emergency, Reception & Pharmacy', zones: [] as any[] }
];

const DEPT_FLOOR_MAP: Record<string, string> = {
  "Cardiology": "1",
  "Orthopedics": "1",
  "Neurology": "2",
  "Pediatrics": "2",
  "Emergency": "G",
  "General Medicine": "1",
  "Dermatology": "1",
  "Radiology": "G",
};

export default function HospitalMapPage() {
  const [activeFloorId, setActiveFloorId] = useState('G');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<any | null>(null);
  
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [docsRes, roomsRes] = await Promise.all([
          appointmentsApi.getDoctors(),
          enhancementsApi.roomAvailability()
        ].map(p => p.catch(e => null)));
        
        let fetchedDoctors = docsRes?.data || [];
        let fetchedRooms = roomsRes?.data?.rooms || [];

        if (!fetchedRooms.length) {
          const publicRes = await enhancementsApi.publicRoomAvailability().catch(() => null);
          if (publicRes?.data) fetchedRooms = publicRes.data;
        }

        const newFloors = JSON.parse(JSON.stringify(DEFAULT_FLOORS));
        
        const roomGroups: Record<string, any> = {};
        fetchedRooms.forEach((room: any) => {
          let fId = room.floor ? room.floor.toString().toUpperCase() : '1';
          if (fId === 'GROUND' || fId === '0') fId = 'G';
          if (!newFloors.find((f: any) => f.id === fId)) fId = '1';

          const zoneKey = `${fId}-${room.ward || room.room_type || 'General'}`;
          if (!roomGroups[zoneKey]) {
            roomGroups[zoneKey] = {
              id: zoneKey,
              name: room.ward || `${room.room_type} Ward`,
              type: room.room_type.toLowerCase().includes('icu') ? 'critical' : 'ward',
              floorId: fId,
              rooms: [],
              color: 'bg-neutral-100 border-neutral-300 text-neutral-800'
            };
            if (roomGroups[zoneKey].type === 'critical') roomGroups[zoneKey].color = 'bg-neutral-800 border-neutral-900 text-white';
          }
          roomGroups[zoneKey].rooms.push(room.room_number);
        });

        const docGroups: Record<string, any> = {};
        fetchedDoctors.forEach((doc: any) => {
          const dept = doc.department || 'General Medicine';
          let fId = DEPT_FLOOR_MAP[dept] || '1';
          
          const zoneKey = `${fId}-dept-${dept}`;
          if (!docGroups[zoneKey]) {
            docGroups[zoneKey] = {
              id: zoneKey,
              name: `${dept} Dept.`,
              type: 'department',
              floorId: fId,
              doctors: [],
              color: 'bg-white border-neutral-300 text-neutral-900'
            };
          }
          docGroups[zoneKey].doctors.push({ name: doc.name, spec: doc.specialization });
        });

        newFloors.find((f: any) => f.id === 'G').zones.push(
          { id: 'zg-2', name: 'Main Reception', type: 'public', color: 'bg-neutral-50 border-neutral-200 text-neutral-800' },
          { id: 'zg-3', name: 'Pharmacy', type: 'public', color: 'bg-neutral-100 border-neutral-300 text-neutral-800' },
          { id: 'zg-4', name: 'Cafeteria', type: 'public', color: 'bg-neutral-100 border-neutral-300 text-neutral-800' }
        );

        Object.values(roomGroups).forEach((z: any) => {
          const f = newFloors.find((f: any) => f.id === z.floorId);
          if (f) f.zones.push(z);
        });
        Object.values(docGroups).forEach((z: any) => {
          const f = newFloors.find((f: any) => f.id === z.floorId);
          if (f) f.zones.push(z);
        });

        setFloors(newFloors);
      } catch (err) {
        console.error("Failed to load map data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[2], [activeFloorId, floors]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: any[] = [];

    floors.forEach(floor => {
      floor.zones.forEach((zone: any) => {
        let matched = false;
        if (zone.name.toLowerCase().includes(query)) matched = true;
        
        const matchedDoctors = zone.doctors?.filter((d: any) => d.name.toLowerCase().includes(query) || d.spec.toLowerCase().includes(query));
        if (matchedDoctors && matchedDoctors.length > 0) matched = true;

        const matchedRooms = zone.rooms?.filter((r: any) => r.toLowerCase().includes(query));
        if (matchedRooms && matchedRooms.length > 0) matched = true;

        if (matched) {
          results.push({
            floor,
            zone,
            matchedDoctors,
            matchedRooms
          });
        }
      });
    });

    return results;
  }, [searchQuery, floors]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-neutral-500">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-900 mb-4" />
        <p>Loading hospital layout from database...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <MapPin className="text-neutral-900" /> Hospital Directory & Map
          </h1>
          <p className="text-neutral-500 mt-1">Live data from the hospital database.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search doctors, rooms, departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
          />
          
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
              <div className="p-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-50">Search Results</div>
              {searchResults.map((res, i) => (
                <div 
                  key={i} 
                  className="p-3 border-b border-neutral-100 hover:bg-neutral-100 cursor-pointer transition-colors"
                  onClick={() => {
                    setActiveFloorId(res.floor.id);
                    setSelectedZone(res.zone);
                    setSearchQuery('');
                  }}
                >
                  <div className="font-medium text-neutral-900">{res.zone.name}</div>
                  <div className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
                    <Navigation className="w-3 h-3" /> {res.floor.name}
                  </div>
                  {res.matchedDoctors && res.matchedDoctors.length > 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-neutral-900 font-medium">Doctors:</span> {res.matchedDoctors.map((d: any) => d.name).join(', ')}
                    </div>
                  )}
                  {res.matchedRooms && res.matchedRooms.length > 0 && (
                    <div className="mt-1 text-sm">
                      <span className="text-neutral-900 font-medium">Rooms:</span> {res.matchedRooms.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 h-fit">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 px-2">Select Floor</h2>
          <div className="space-y-2 flex flex-col-reverse">
            {floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => {
                  setActiveFloorId(floor.id);
                  setSelectedZone(null);
                }}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 border ${
                  activeFloorId === floor.id 
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-md shadow-neutral-200' 
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <div className="font-semibold text-lg">{floor.name}</div>
                <div className={`text-sm mt-1 ${activeFloorId === floor.id ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  {floor.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">{activeFloor.name}</h2>
                <p className="text-neutral-500">{activeFloor.description}</p>
              </div>
            </div>
            
            <div className="p-6 bg-neutral-50/50 min-h-[500px]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-fr">
                {activeFloor.zones.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-neutral-500">
                    No departments or rooms found on this floor.
                  </div>
                ) : activeFloor.zones.map((zone: any) => (
                  <div 
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`relative p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[160px]
                      ${zone.color} 
                      ${selectedZone?.id === zone.id ? 'ring-4 ring-neutral-900 ring-offset-2 scale-[1.02] shadow-lg' : 'hover:scale-[1.02] hover:shadow-md'}
                    `}
                  >
                    <div>
                      <h3 className={`font-bold text-lg mb-2 ${zone.color.includes('text-white') ? 'text-white' : ''}`}>{zone.name}</h3>
                      {zone.doctors && (
                        <div className="flex items-center gap-1.5 text-sm opacity-90 mt-2 font-medium">
                          <Stethoscope className="w-4 h-4" /> {zone.doctors.length} Doctor(s)
                        </div>
                      )}
                      {zone.rooms && (
                        <div className="flex items-center gap-1.5 text-sm opacity-90 mt-1 font-medium">
                          <Bed className="w-4 h-4" /> {zone.rooms.length} Room(s)
                        </div>
                      )}
                    </div>
                    
                    <div className={`absolute bottom-4 right-4 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                      ${zone.color.includes('bg-neutral-800') ? 'bg-neutral-900 text-white' : 'bg-white/50 backdrop-blur-sm text-neutral-900'}
                    `}>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedZone && (
            <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 animate-fadeIn relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-neutral-900"></div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                    {selectedZone.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-neutral-500">
                    <MapPin className="w-4 h-4" /> Located on {activeFloor.name}
                  </div>
                </div>
                <div className={`px-3 py-1 border rounded-full text-xs font-semibold uppercase tracking-wider ${
                  selectedZone.type === 'critical' ? 'bg-neutral-800 text-white border-neutral-900' :
                  selectedZone.type === 'ward' ? 'bg-neutral-100 text-neutral-800 border-neutral-200' :
                  'bg-white text-neutral-900 border-neutral-200'
                }`}>
                  {selectedZone.type}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedZone.doctors && selectedZone.doctors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-neutral-900" /> Doctors on Duty
                    </h4>
                    <div className="space-y-3">
                      {selectedZone.doctors.map((doc: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                          <div className="w-10 h-10 rounded-full bg-neutral-200 text-neutral-800 flex items-center justify-center font-bold">
                            {doc.name.split(' ')[1]?.[0] || doc.name[0]}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900">{doc.name}</div>
                            <div className="text-sm text-neutral-500">{doc.spec}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedZone.rooms && selectedZone.rooms.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Bed className="w-4 h-4 text-neutral-900" /> Rooms in this zone
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedZone.rooms.map((room: string, i: number) => (
                        <div key={i} className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 shadow-sm">
                          {room}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!selectedZone.doctors || selectedZone.doctors.length === 0) && (!selectedZone.rooms || selectedZone.rooms.length === 0) && (
                  <div className="col-span-full py-8 text-center text-neutral-500 flex flex-col items-center">
                    <Info className="w-8 h-8 text-neutral-300 mb-2" />
                    <p>No specific room or doctor information available for this zone.</p>
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
