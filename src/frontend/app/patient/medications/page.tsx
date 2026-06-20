import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientMedicationsPage() {
  return (
    <EnhancementWorkspace
      title="Medications"
      focus="Timeline, adherence, dispenser sync, and missed-dose alerts."
      endpoints={['Medication timeline', 'Dispenser registration', 'Schedule sync', 'Adherence events']}
    />
  );
}
