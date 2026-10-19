import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth-frame';
import { AuthFlow } from '@/components/auth-flow';
import { LAST_EMAIL, safeNext } from '@/lib/auth-after';
import { Expired } from './expired';

export const dynamic = 'force-dynamic';

// Sign in or create an account, email first (decision 0013).
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) redirect(next);
  // A join link always signs in on its own page, with the team in view.
  const join = next.match(/^\/join\/([A-Za-z0-9]{8,64})$/);
  if (join && !error) redirect(next);
  const last = (await cookies()).get(LAST_EMAIL)?.value ?? '';

  return (
    <AuthFrame>
      {error ? (
        <Expired email={last} next={next} />
      ) : (
        <AuthFlow
          next={next}
          initialEmail={last}
          intro={
            <div className="mt-16 flex flex-col gap-3 lg:mt-[120px]">
              <h1 className="font-display text-[36px] font-extrabold leading-[40px] tracking-[-0.025em] text-balance lg:text-[44px] lg:leading-[48px]">U7 &amp; U9 practices, planned in minutes</h1>
              <p className="text-[17px] leading-[26px] text-ink-200">Drills from Hockey Canada&apos;s U7 and U9 programs, stations on half ice, and a sheet for the bench.</p>
            </div>
          }
        />
      )}
    </AuthFrame>
  );
}
