import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientFamilyPage() {
  return (
    <EnhancementWorkspace
      title="Family Access"
      focus="Family groups, dependents, and scoped access levels."
      endpoints={['Family groups', 'Family members', 'Access levels', 'Patient grants']}
    />
  );
}
