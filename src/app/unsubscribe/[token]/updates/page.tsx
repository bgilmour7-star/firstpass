import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBroadcastStore } from '@/lib/broadcasts/store';
import { PublicFrame } from '@/components/public-frame';
import { StopUpdates } from './stop';

// Stop update emails (decision 0035), linked from every email Brett sends from Admin → Send. A button, not a GET
// that unsubscribes on its own, so mail scanners that open every link can't unsubscribe people. Survey emails and
// practice emails aren't affected.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Stop update emails · Firstpass', robots: { index: false, follow: false } };

export default async function StopUpdatesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9-]{6,64}$/.test(token)) notFound();
  const off = await (await getBroadcastStore()).updatesStatus(token);
  if (off === null) notFound();
  return (
    <PublicFrame>
      <div className="flex flex-col gap-5 px-7 pt-16">
        {off ? (
          <>
            <h1 className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.02em]">Update emails stopped.</h1>
            <p className="text-base leading-6">You’ll still get practice emails. Turn those off in your Account.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.02em]">Stop update emails?</h1>
            <p className="text-base leading-6">You won’t get any more updates from Brett about Firstpass. You’ll still get practice emails, like the check-in after practice.</p>
            <StopUpdates token={token} />
          </>
        )}
        <p className="text-[13px] leading-[19px] text-ink-200">
          Changed your mind, or want your details removed? Write to hello@firstpass.coach. <Link href="/privacy" className="underline">Privacy</Link>
        </p>
      </div>
    </PublicFrame>
  );
}
