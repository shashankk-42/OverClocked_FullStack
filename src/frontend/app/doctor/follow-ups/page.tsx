import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function DoctorFollowUpsPage() {
  return (
    <EnhancementWorkspace
      title="Follow-Ups"
      focus="Questionnaires, symptom review, adherence checks, and AI risk scoring."
      mode="follow-ups"
    />
  );
}
