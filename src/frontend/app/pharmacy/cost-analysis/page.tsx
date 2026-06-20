import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function PharmacyCostAnalysisPage() {
  return (
    <EnhancementWorkspace
      title="Cost Analysis"
      focus="Prescription cost breakdown, generic alternatives, and doctor-approved substitutions."
      mode="pharmacy-cost"
    />
  );
}
