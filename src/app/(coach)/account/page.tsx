import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { signOut } from '@/app/auth/actions';
import { Profile } from './profile';
import { InstallSection } from '@/components/pwa';

export const dynamic = 'force-dynamic';

// Your account (decision 0014): name, sign-in email, password, team, sign out.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const coach = await requireUser('/account');
  const { email: emailState } = await searchParams;
  const store = await getAppStore();
  const team = await store.myTeam(coach.id);
  const role = team ? (await store.coaches(team.id)).find((c) => c.userId === coach.id)?.role : undefined;
  const meta = coach.local ? null : await namedYet();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-extrabold leading-9">Account</h1>
        <p className="text-sm text-ink-200">How you sign in, and the name your co-coaches see.</p>
      </div>

      <Profile name={meta?.firstName ?? ''} email={coach.email} local={coach.local} emailState={emailState === 'changed' || emailState === 'half' ? emailState : null} />

      {!coach.local && (
        <section className="flex flex-col gap-2 border-t border-border-100 pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-semibold">Password</h2>
            <Link href="/account/password?next=/account" className="min-h-11 content-center text-sm font-medium text-rink-100 hover:underline">
              {coach.hasPassword ? 'Change' : 'Set a password'}
            </Link>
          </div>
          <p className="text-sm text-ink-200">{coach.hasPassword ? 'You sign in with your password, or a link from your email.' : 'You sign in with a link and code from your email. Add a password to skip the email.'}</p>
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-border-100 pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold">Team</h2>
          {team && (
            <Link href="/team" className="min-h-11 content-center text-sm font-medium text-rink-100 hover:underline">
              Team settings
            </Link>
          )}
        </div>
        <p className="text-sm text-ink-200">
          {team ? (
            <>
              <b className="font-semibold text-ink-100">{team.name}</b> · {role === 'head_coach' ? 'Head coach' : 'Coach'}. After-practice emails are on the Team page.
            </>
          ) : (
            'Not on a team yet.'
          )}
        </p>
      </section>

      <InstallSection />

      {!coach.local && (
        <section className="border-t border-border-100 pt-5">
          <form action={signOut}>
            <button type="submit" className="inline-flex h-11 items-center rounded-full border-[1.5px] border-border-200 px-5 text-sm font-medium hover:bg-surface-200">
              Sign out
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

/** The name as saved, not the fallback made from the email, so an unset name shows an empty field. */
async function namedYet(): Promise<{ firstName: string }> {
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data } = await (await supabaseServer()).auth.getUser();
  return { firstName: String((data.user?.user_metadata as { first_name?: string } | undefined)?.first_name ?? '') };
}
