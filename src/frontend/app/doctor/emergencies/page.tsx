import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function DoctorEmergenciesPage() {
  return (
    <EnhancementWorkspace
      title="Emergencies"
      focus="Escalation queue, responder assignment, status transitions, and resolution notes."
      mode="emergencies"
    />
  );
}
