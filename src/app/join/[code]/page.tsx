import Link from 'next/link';
import { redirect } from 'next/navigation';
import { optionalUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AuthFrame } from '@/components/auth-frame';
import { AuthFlow } from '@/components/auth-flow';
import { clock } from '@/lib/plans/schema';
import { joinTeam } from '../actions';

export const dynamic = 'force-dynamic';

// Where a coach lands from a team's join link (decisions 0011, 0013). Signed out, it says who
// invited them and to which team, then signs them in or creates their account right here and
// joins in the same step. Signed in, it's one button.
export default async function JoinPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string; email?: string }> }) {
  const { code } = await params;
  const { error, email } = await searchParams;
  if (!/^[A-Za-z0-9]{8,64}$/.test(code)) return <Off />;
  const store = await getAppStore();
  const [coach, team] = await Promise.all([optionalUser(), store.joinCodeTeam(code)]);
  const mine = coach ? await store.myTeam(coach.id) : null;
  if (team && mine?.id === team.id && !error) redirect('/plans');

  if (error === 'link-off' || (coach && !team)) return <Off back={!!mine} />;
  if (mine || error === 'on-another-team')
    return (
      <AuthFrame panel={false}>
        <div className="mt-14 flex flex-col gap-3">
          <h1 className="font-display text-[30px] font-extrabold leading-[34px]">You&apos;re already on {mine?.name ?? 'another team'}</h1>
          <p className="text-[15px] leading-[22px] text-ink-200">
            During the pilot a coach is on one team at a time, so you can&apos;t join {team?.name ?? 'this team'} as well. If you meant to switch, ask your head coach to remove you first.
          </p>
          <Back />
        </div>
      </AuthFrame>
    );

  const heading = (
    <div className="mt-10 flex flex-col gap-2.5">
      {team?.inviter && (
        <p className="flex items-center gap-2.5 text-sm text-ink-200">
          <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rink-200 text-xs font-semibold text-surface-100">
            {team.inviter.charAt(0).toUpperCase()}
          </span>
          <span>
            <b className="font-semibold text-ink-100">{team.inviter}</b> invited you to coach
          </span>
        </p>
      )}
      <h1 className="font-display text-[36px] font-extrabold leading-[40px] tracking-[-0.02em] text-balance">{team ? `Join ${team.name}` : 'Join your team on Firstpass'}</h1>
      {team?.next && (
        <p className="mt-3 flex flex-col gap-0.5 border-y border-border-100 py-3">
          <span className="text-xs text-ink-200">Next practice</span>
          <span className="text-[15px] font-semibold">
            {new Date(team.next.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock(team.next.startTime)}
          </span>
          <span className="text-[13px] text-ink-200">
            {team.next.ice === 'half' ? 'Half ice' : 'Full ice'} · {team.next.blocks} block{team.next.blocks === 1 ? '' : 's'} planned
          </span>
        </p>
      )}
    </div>
  );

  if (!coach)
    return (
      <AuthFrame>
        <AuthFlow next={`/join/${code}`} join={{ code, teamName: team?.name ?? 'the team' }} initialEmail={email ?? ''} intro={heading} />
      </AuthFrame>
    );

  return (
    <AuthFrame>
      {heading}
      <form action={joinTeam.bind(null, code)} className="mt-7 flex flex-col gap-2">
        <button type="submit" className="inline-flex h-[52px] items-center justify-center rounded-full bg-rink-100 font-semibold text-surface-100 hover:bg-rink-200">
          Join the team
        </button>
        {error === 'failed' && (
          <p role="alert" className="text-[13px] text-flag-100">
            Couldn&apos;t join just now. Try again in a minute.
          </p>
        )}
        <p className="mt-1 text-center text-[13px] text-ink-200">Signed in as {coach.email}.</p>
      </form>
    </AuthFrame>
  );
}

function Off({ back }: { back?: boolean }) {
  return (
    <AuthFrame panel={false}>
      <div className="mt-14 flex flex-col gap-3">
        <h1 className="font-display text-[30px] font-extrabold leading-[34px]">This join link is turned off</h1>
        <p className="text-[15px] leading-[22px] text-ink-200">The head coach replaced it or turned it off. Ask them for the team&apos;s current link.</p>
        {back && <Back />}
      </div>
    </AuthFrame>
  );
}

function Back() {
  return (
    <Link href="/plans" className="mt-3 inline-flex h-[52px] items-center justify-center rounded-full border-[1.5px] border-border-200 text-[15px] font-medium hover:bg-surface-200">
      Go to my plans
    </Link>
  );
}
