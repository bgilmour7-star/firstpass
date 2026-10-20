import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { usingSupabase } from '@/lib/drills/store';
import { optionalUser } from '@/lib/auth';
import { Landing } from '@/components/landing/landing';

// firstpass.coach: the public landing page for visitors (decision 0019). Signed-in coaches go
// straight to their plans, as before.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Firstpass · Practice plans for U5–U9 hockey',
  description: 'Set up your team once and every practice arrives planned: timed to your ice, split for your skill groups, and ready on your phone at the rink.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://firstpass.coach' },
  openGraph: {
    title: 'Show up ready. Firstpass practice plans for U5–U9 hockey',
    description: 'Set up your team once and every practice arrives planned: timed to your ice, split for your skill groups, and ready on your phone at the rink.',
    url: 'https://firstpass.coach',
    siteName: 'Firstpass',
    type: 'website',
    locale: 'en_CA',
  },
};

export default async function Home() {
  if (usingSupabase() && (await optionalUser())) redirect('/plans');
  return <Landing />;
}
