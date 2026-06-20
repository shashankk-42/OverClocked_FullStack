import { EnhancementWorkspace } from '@/components/shared/EnhancementWorkspace';

export default function ReceptionWaitlistPage() {
  return (
    <EnhancementWorkspace
      title="Earlier Slots"
      focus="Waitlist entries, cancellation-triggered offers, expiry, and one-click acceptance."
      endpoints={['Waitlist', 'Earlier offers', 'Offer acceptance', 'Recovery options']}
    />
  );
}
