import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function DoctorCareTeamsPage() {
  return (
    <EnhancementWorkspace
      title="Care Teams"
      focus="Shared notes, treatment plans, specialist referrals, and collaborative ownership."
      mode="care-teams"
    />
  );
}
