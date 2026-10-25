import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDiscoveryStore } from '@/lib/discovery/store';
import { PublicFrame } from '@/components/public-frame';
import { Confirm } from './confirm';

// Stop survey emails (decision 0027), linked from every discovery email. A button, not a GET that
// unsubscribes on its own, so mail scanners that open every link can't unsubscribe people. Practice
// emails (check-ins, invites, sign-in) aren't affected.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Stop survey emails · Firstpass', robots: { index: false, follow: false } };

export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9-]{6,64}$/.test(token)) notFound();
  const status = await (await getDiscoveryStore()).unsubscribeStatus(token);
  if (!status) notFound();
  const coach = status.audience === 'coach';
  return (
    <PublicFrame>
      <div className="flex flex-col gap-5 px-7 pt-16">
        {status.unsubscribed ? (
          <Done coach={coach} />
        ) : (
          <>
            <h1 className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.02em]">{coach ? 'Stop survey emails?' : 'Unsubscribe?'}</h1>
            <p className="text-base leading-6">{coach ? 'You won’t get any more emails about the survey. You’ll still get practice emails, like the check-in after practice.' : 'You won’t get another email from us about the survey or the waitlist.'}</p>
            <Confirm token={token} label={coach ? 'Stop survey emails' : 'Unsubscribe'} coach={coach} />
          </>
        )}
      </div>
    </PublicFrame>
  );
}

function Done({ coach }: { coach: boolean }) {
  return (
    <>
      <h1 className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.02em]">{coach ? 'Survey emails stopped.' : 'You’re unsubscribed.'}</h1>
      <p className="text-base leading-6">{coach ? 'You’ll still get practice emails. Turn those off on your Team page.' : 'You won’t get another email from us.'}</p>
      <p className="text-[13px] leading-[19px] text-ink-200">
        Changed your mind, or want your details removed? Write to hello@firstpass.coach. <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </>
  );
}
