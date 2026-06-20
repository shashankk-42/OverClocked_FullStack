import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientRoomsPage() {
  return (
    <EnhancementWorkspace
      title="Rooms"
      focus="Patient-facing room types, pricing, amenities, and availability."
      endpoints={['Public availability', 'Room pricing', 'Amenities', 'Bed status']}
    />
  );
}
