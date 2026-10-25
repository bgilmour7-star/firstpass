import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDiscoveryStore } from '@/lib/discovery/store';
import { PublicFrame } from '@/components/public-frame';
import { Survey } from './survey';

// The discovery survey (decision 0027; canvas S1–S4): public, no sign-in, phone first, one question
// per screen. The token in the link is the only key: it says who this is and whether they've answered.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your last practice · Firstpass', robots: { index: false, follow: false } };

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9-]{6,64}$/.test(token)) notFound();
  const invite = await (await getDiscoveryStore()).invite(token);
  if (!invite) notFound();
  if (invite.used) {
    return (
      <PublicFrame>
        <div className="flex flex-col gap-4 px-7 pt-16">
          <h1 className="font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">You’ve already answered. Thank you.</h1>
          <p className="text-base leading-6">Your answers are in. If there’s anything else, reply to any Firstpass email or write to hello@firstpass.coach.</p>
          <Link href="/" className="text-rink-100 underline">
            firstpass.coach
          </Link>
        </div>
      </PublicFrame>
    );
  }
  return <Survey token={token} audience={invite.audience} email={invite.email} />;
}
