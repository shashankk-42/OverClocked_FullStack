import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function ReceptionEmergenciesPage() {
  return (
    <EnhancementWorkspace
      title="Emergencies"
      focus="Hospital-wide escalation visibility and routing support."
      endpoints={['Emergency dashboard', 'Patient lookup', 'Location tracking', 'Responder updates']}
    />
  );
}
