import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientRoomsPage() {
  return (
    <EnhancementWorkspace
      title="Rooms"
      focus="Patient-facing room types, pricing, amenities, and availability."
      mode="patient-rooms"
    />
  );
}
