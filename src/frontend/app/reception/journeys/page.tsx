import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function ReceptionJourneysPage() {
  return (
    <EnhancementWorkspace
      title="Patient Journey"
      focus="Registration, consultation, lab, imaging, pharmacy, and billing step tracking."
      endpoints={['Journey creation', 'Step updates', 'Current step', 'Routing metadata']}
    />
  );
}
