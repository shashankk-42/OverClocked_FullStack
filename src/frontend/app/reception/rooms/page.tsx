import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function ReceptionRoomsPage() {
  return (
    <EnhancementWorkspace
      title="Rooms & Beds"
      focus="Room availability, bed availability, ICU occupancy, and ward status."
      endpoints={['Room availability', 'Bed creation', 'Bed status', 'Occupancy summary']}
    />
  );
}
