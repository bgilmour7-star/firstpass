import { notFound } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { drillIds, withStationDrills } from '@/lib/plans/schema';
import { Builder } from './builder';
import { CheckinNudge } from './check-in/nudge';
import { practiceOver, rateUnits } from '@/lib/plans/checkin';
import type { GoalSteer, SuggestContext } from './suggestions';
import { progressState } from '@/lib/progress/load';
import { getProgressStore } from '@/lib/progress/store';
import { goalsView } from '@/lib/progress/goals-view';
import { STATUS_WORDS } from '@/lib/progress/pace';
import { drillFeedback, type DrillFeedback } from '@/lib/plans/feedback';
import { drillsForAge } from '@/lib/drills/age';
import { teamPractices } from '@/lib/app/read';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string }> }) {
  const { coach, team } = await requireTeam('/plans');
  const { id } = await params;
  const { copied } = await searchParams;
  const store = await getAppStore();
  const practice = await store.getPractice(id);
  if (!practice || practice.teamId !== team.id) notFound();
  // Opening the plan clears its "changed since you last looked" dot on the Plans list.
  await store.markViewed(practice.id, coach.id).catch(() => undefined);
  const [all, drills, share, checkins, favorites, kept] = await Promise.all([teamPractices(team.id), store.libraryDrills(), store.activeShare(practice.id), store.teamCheckins(team.id).catch(() => []), store.favorites(team.id), store.keptSuggestions(practice.id).catch(() => [])]);
  // Drills the kids have done before this practice ("known"), for the New tag and the library drawer.
  const earlier = all.filter((p) => p.id !== practice.id && p.date < practice.date).sort((a, b) => b.date.localeCompare(a.date));
  const known = [...new Set(earlier.flatMap((p) => p.blocks.flatMap(drillIds)))];
  // For the drawer: when each drill last ran, and what ran in the last two practices ("not used lately").
  const lastRun: Record<string, string> = {};
  for (const p of earlier) for (const d of p.blocks.flatMap(drillIds)) lastRun[d] ??= p.date;
  const recent = [...new Set(earlier.slice(0, 2).flatMap((p) => p.blocks.flatMap(drillIds)))];
  const byId = new Map(drills.map((d) => [d.id, d]));
  // What can be picked, swapped in or suggested: drills for the team's age (decision 0025).
  const forAge = drillsForAge(drills, team.ageGroup);
  // The practice just before this one, if it happened in the last two weeks and you haven't checked in on it.
  const prev = earlier.find((p) => practiceOver(p));
  const recentEnough = prev && (Date.parse(practice.date) - Date.parse(prev.date)) / 864e5 <= 14;
  const checkedIn = prev ? checkins.some((c) => c.practiceId === prev.id && c.userId === coach.id) : true;
  // What coaches said about each drill at earlier practices, shown on the drill wherever it turns up.
  const byPractice = new Map(all.map((p) => [p.id, p]));
  const fb = drillFeedback(checkins, new Map(all.map((p) => [p.id, p.date])), practice.date, (c) => {
    const p = byPractice.get(c.practiceId);
    if (!p || !c.steamFrom) return null;
    return rateUnits({ ...p, blocks: withStationDrills(p.blocks, byId) }, team, byId).find((u) => u.key === c.steamFrom)?.drillId ?? null;
  });
  const feedback: Record<string, DrillFeedback> = Object.fromEntries(fb);
  // Suggestions (decision 0022): from the check-ins on the practice just before this one, if it was in the last two weeks.
  const last = earlier[0];
  const lastCheckins = last ? checkins.filter((c) => c.practiceId === last.id) : [];
  const runs: Record<string, number> = {};
  for (const p of earlier) for (const d of new Set(p.blocks.flatMap(drillIds))) runs[d] = (runs[d] ?? 0) + 1;
  // Season goals (decision 0030): a goal behind this month's target may suggest one swap, and the margin
  // shows this plan's share of drill time against what the goals ask for.
  const goals = await seasonGoals(team, coach.id, all, byId);
  const suggest: SuggestContext | null =
    last && lastCheckins.length && (Date.parse(practice.date) - Date.parse(last.date)) / 864e5 <= 14
      ? {
          last: { date: last.date, blocks: last.blocks },
          checkins: lastCheckins,
          units: rateUnits({ ...last, blocks: withStationDrills(last.blocks, byId) }, team, byId),
          runs,
          kept,
          day: new Date(`${last.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' }),
          goals,
        }
      : goals
        ? { last: { date: last?.date ?? '', blocks: last?.blocks ?? [] }, checkins: [], units: [], runs, kept, day: null, goals }
        : null;
  const nudge = prev && recentEnough && !checkedIn ? <CheckinNudge practiceId={prev.id} day={new Date(`${prev.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' })} /> : null;
  return (
    <>
      {nudge}
      <Builder initial={{ ...practice, blocks: withStationDrills(practice.blocks, byId) }} team={team} drills={drills} pool={forAge.drills} ageNotice={forAge.notice} known={known} lastRun={lastRun} recent={recent} feedback={feedback} suggest={suggest} favorites={favorites} copiedFrom={copied ?? null} initialShare={share} />
    </>
  );
}

async function seasonGoals(team: Awaited<ReturnType<typeof requireTeam>>['team'], userId: string, practices: Parameters<typeof goalsView>[4], byId: Parameters<typeof goalsView>[5]): Promise<GoalSteer | undefined> {
  const state = await progressState(team, userId).catch(() => null);
  if (!state || state.kind !== 'ready') return undefined;
  const goals = await (await getProgressStore()).goals(team.id).catch(() => []);
  if (!goals.length) return undefined;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const v = goalsView(goals, state.rounds, state.scores, userId, practices, byId, today);
  return {
    list: v.goals.map((g) => ({ attribute: g.goal.attribute, status: g.status ? STATUS_WORDS[g.status] : 'Not scored yet', behind: g.status === 'behind', now: g.now, expected: g.expected, target: g.target, targetShare: g.targetShare })),
    targets: v.targets,
  };
}
