import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { ATTRIBUTES, type Attribute } from '@/lib/progress/levels';
import { progressState } from '@/lib/progress/load';
import { getProgressStore } from '@/lib/progress/store';
import { canSeeReport, monthName, teamReport, type Counts } from '@/lib/progress/report';
import { GoalEditor } from './editor';

export const dynamic = 'force-dynamic';

/** The end of the season by default: March 15 of the season this falls in. */
function seasonEnd(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return `${m >= 4 ? y + 1 : y}-03-15`;
}

// Season goals (decision 0030): the head coach sets up to three, after the team's first finished report.
export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  const { coach, team } = await requireTeam('/progress/goals');
  const { skill } = await searchParams;
  const state = await progressState(team, coach.id);
  if (state.kind !== 'ready') redirect('/progress');
  const back = (
    <Link href="/progress" className="text-sm text-rink-100">
      ← Progress
    </Link>
  );
  if (!state.isHead)
    return (
      <Shell back={back} title="Season goals">
        <p className="text-sm text-ink-200">Your head coach sets the team’s season goals. You’ll see them on the progress report.</p>
      </Shell>
    );
  // Goals start from the newest report the head coach can see.
  const seen = state.rounds.find((r) => canSeeReport(state.scores, r.id, coach.id));
  if (!seen)
    return (
      <Shell back={back} title="Season goals">
        <p className="text-sm text-ink-200">Goals start from where the team is now. Score this month first, then set them from your report.</p>
        {state.open && state.scoring && (
          <Link href="/progress/score" className="mt-2 min-h-12 self-start rounded-full bg-rink-100 px-6 py-3 text-base font-semibold text-surface-100">
            Score {monthName(state.current!.month)}
          </Link>
        )}
      </Shell>
    );
  const report = teamReport(seen, state.scores);
  const now = Object.fromEntries(ATTRIBUTES.map((a) => [a, report.attributes.find((x) => x.attribute === a)!.spread])) as Record<Attribute, Counts>;
  const goals = await (await getProgressStore()).goals(team.id);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  return (
    <Shell back={back} title="Season goals">
      <p className="text-sm text-ink-200">
        Pick up to three skills. For each, move kids up a level in the Goal column to where you’d like the team by the end of the season. It starts from your {monthName(seen.month)} report. Plans lean toward goals that fall behind.
      </p>
      <GoalEditor
        attributes={ATTRIBUTES}
        levels={state.levels.levels}
        now={now}
        existing={goals.map((g) => ({ id: g.id, attribute: g.attribute, target: g.target, byDate: g.byDate }))}
        defaultDate={seasonEnd(today)}
        start={(ATTRIBUTES as readonly string[]).includes(skill ?? '') ? (skill as Attribute) : null}
      />
    </Shell>
  );
}

function Shell({ back, title, children }: { back: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      {back}
      <h1 className="font-display text-[28px] font-bold leading-tight">{title}</h1>
      {children}
    </div>
  );
}
