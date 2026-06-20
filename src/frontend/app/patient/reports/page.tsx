import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PatientReportsPage() {
  return (
    <EnhancementWorkspace
      title="Test Results"
      focus="Secure report access, sharing, downloads, and clinical history."
      endpoints={['Report shares', 'Secure access tokens', 'Historical profile', 'Audit tracking']}
    />
  );
}
