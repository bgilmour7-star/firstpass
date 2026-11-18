import { redirect } from 'next/navigation';

// The Waitlist tab became Leads (decision 0034). Older lead-alert emails still link here.
export default function WaitlistMoved() {
  redirect('/admin/leads');
}
