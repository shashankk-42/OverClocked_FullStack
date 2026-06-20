import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PharmacyDispensersPage() {
  return (
    <EnhancementWorkspace
      title="Dispensers"
      focus="Device registration, medication schedule sync, adherence events, and missed-dose alerts."
      endpoints={['Device registry', 'Schedule sync', 'Dose events', 'Missed-dose alerts']}
    />
  );
}
