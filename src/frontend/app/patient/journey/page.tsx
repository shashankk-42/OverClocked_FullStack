import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientJourneyPage() {
  return (
    <EnhancementWorkspace
      title="Care Journey"
      focus="Current step, next destination, location, and expected duration."
      mode="patient-journey"
    />
  );
}
