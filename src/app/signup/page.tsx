import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth-frame';
import { AuthFlow } from '@/components/auth-flow';
import { LAST_EMAIL, safeNext } from '@/lib/auth-after';
import { ClearSaved } from '@/components/pwa';

export const dynamic = 'force-dynamic';

// Where "Plan your first practice" lands (decision 0033): the same email-first flow as /login, framed for
// a new coach. An email that already has an account still goes to Welcome back, so nobody gets stuck here.
// A Google sign-in that doesn't finish returns to /login with its notice, as before.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) redirect(next);
  const last = (await cookies()).get(LAST_EMAIL)?.value ?? '';

  return (
    <AuthFrame>
      <ClearSaved />
      <AuthFlow
        next={next}
        initialEmail={last}
        intro={
          <div className="mt-16 flex flex-col gap-3 lg:mt-[120px]">
            <h1 className="font-display text-[36px] font-extrabold leading-[40px] tracking-[-0.025em] text-balance lg:text-[44px] lg:leading-[48px]">Create your free account</h1>
            <p className="text-[17px] leading-[26px] text-ink-200">Your first team is free. Set up your team, then plan your first practice.</p>
          </div>
        }
      />
    </AuthFrame>
  );
}
