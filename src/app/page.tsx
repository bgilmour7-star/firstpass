import { redirect } from 'next/navigation';

// The coach app comes in later milestones (docs/build-plan.md). For now the only screen is drill review.
export default function Home() {
  redirect('/admin/drills');
}
