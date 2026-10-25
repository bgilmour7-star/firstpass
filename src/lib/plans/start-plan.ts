import 'server-only';
import type { AppStore } from '../app/store';
import { copyBlocks, type Practice, type Team } from './schema';
import { firstPlan } from './first-plan';
import { drillsForAge } from '../drills/age';

/**
 * A new plan starts as a copy of the most recent one before it (design decision). With nothing to
 * copy, the first one comes ready to run (decision 0023). Used by Plans and by Create a team (0026).
 */
export async function startPlan(store: AppStore, team: Team, coachId: string, at: { date: string; startTime: string; minutes?: number; ice?: Practice['ice'] }) {
  const last = (await store.listPractices(team.id)).filter((p) => p.date <= at.date)[0];
  const groups = team.groups.filter((g) => !g.off && g.skaters > 0).length || 3;
  const blocks = last ? copyBlocks(last.blocks) : firstPlan(at.minutes ?? team.practiceMinutes, drillsForAge(await store.libraryDrills(), team.ageGroup).drills, groups, team.ageGroup);
  const p = await store.createPractice(
    {
      teamId: team.id,
      date: at.date,
      startTime: at.startTime,
      minutes: at.minutes ?? last?.minutes ?? team.practiceMinutes,
      ice: at.ice ?? (team.ice === 'full' ? 'full' : 'half'),
      status: 'draft',
      blocks,
      // Who's here is set fresh for each practice; it starts as the team's usual groups.
      attendance: null,
    },
    coachId,
  );
  return { p, last };
}
