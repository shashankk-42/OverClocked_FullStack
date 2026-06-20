import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientEmergencyPage() {
  return (
    <EnhancementWorkspace
      title="Emergency"
      focus="Trigger urgent escalation, notify responders, and track resolution status."
      mode="emergencies"
    />
  );
}
