import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { Mark } from '@/components/app-shell';
import { joinTeam } from '../actions';

export const dynamic = 'force-dynamic';

// Where a co-coach lands from the team's join link (decision 0011).
export default async function JoinPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string }> }) {
  const { code } = await params;
  const { error } = await searchParams;
  const coach = await requireUser(`/join/${code}`);
  const store = await getAppStore();
  const [team, mine] = await Promise.all([store.joinCodeTeam(code), store.myTeam(coach.id)]);
  if (team && mine?.id === team.id) redirect('/plans');

  let body: React.ReactNode;
  if (!team || error === 'link-off') {
    body = (
      <>
        <h1 className="text-2xl font-bold">This join link is turned off</h1>
        <p className="text-sm text-ink-200">The head coach replaced it or turned it off. Ask them for the team&apos;s current link.</p>
        {mine && <Back />}
      </>
    );
  } else if (mine || error === 'on-another-team') {
    body = (
      <>
        <h1 className="text-2xl font-bold">You&apos;re already on {mine?.name ?? 'another team'}</h1>
        <p className="text-sm text-ink-200">
          During the pilot a coach is on one team at a time, so you can&apos;t join {team.name} as well. If you meant to switch, ask your head coach to remove you first.
        </p>
        <Back />
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-2xl font-bold">Join {team.name}</h1>
        <p className="text-sm text-ink-200">You&apos;ll plan practices with the other coaches, run them rink-side and check in after. Team details only: never kids&apos; names.</p>
        <form action={joinTeam.bind(null, code)}>
          <button type="submit" className="min-h-11 w-full rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200">
            Join {team.name}
          </button>
        </form>
        {error === 'failed' && (
          <p role="alert" className="text-sm text-flag-100">
            Couldn&apos;t join just now. Try again in a minute.
          </p>
        )}
        <p className="text-xs text-ink-200">Signed in as {coach.email}.</p>
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <Mark />
        Firstpass
      </p>
      {body}
    </main>
  );
}

function Back() {
  return (
    <Link href="/plans" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-100 px-5 text-sm font-medium hover:bg-surface-200">
      Go to my plans
    </Link>
  );
}
