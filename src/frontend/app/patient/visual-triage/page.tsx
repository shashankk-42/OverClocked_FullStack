import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientVisualTriagePage() {
  return (
    <EnhancementWorkspace
      title="Visual Triage"
      focus="Clinical image upload, AI summary, urgency, and review routing."
      mode="patient-visual-triage"
    />
  );
}
