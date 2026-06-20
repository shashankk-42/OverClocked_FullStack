import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientVisualTriagePage() {
  return (
    <EnhancementWorkspace
      title="Visual Triage"
      focus="Clinical image upload, AI summary, urgency, and review routing."
      endpoints={['Image upload', 'AI analysis', 'Urgency level', 'Emergency linkage']}
    />
  );
}
