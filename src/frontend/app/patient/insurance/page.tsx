import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientInsurancePage() {
  return (
    <EnhancementWorkspace
      title="Insurance"
      focus="Policy storage, eligibility estimates, coverage data, and claims."
      endpoints={['Policies', 'Eligibility checks', 'Coverage estimates', 'Claims']}
    />
  );
}
