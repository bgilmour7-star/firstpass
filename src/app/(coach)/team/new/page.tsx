import { currentTeam, requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { editorLabel } from '@/lib/plans/activity';
import { nextPracticeDate } from '@/lib/plans/next-date';
import { todayLocal } from '@/lib/calendar/sync';
import { Wizard, type WizardContext } from './wizard';

export const dynamic = 'force-dynamic';

// Create a team (decision 0026): one question per screen, for a new coach's first team and for
// "Create a team" in the switcher. It only ever makes a new team; joining is by invite.
export default async function NewTeam() {
  const coach = await requireUser('/team/new');
  const store = await getAppStore();
  const [teams, other] = await Promise.all([store.myTeams(coach.id).catch(() => []), currentTeam(coach.id)]);
  // Teammates from the coach's current team, offered as chips on the Coaches screen.
  const mates = other ? (await store.coaches(other.id).catch(() => [])).filter((c) => c.userId !== coach.id && c.email.includes('@')) : [];
  const guess = nextPracticeDate([], [], todayLocal()) as { date: string; startTime: string };
  const ctx: WizardContext = {
    me: coach.local ? 'You' : coach.name,
    email: coach.email,
    hasTeam: teams.length > 0,
    other: other
      ? { name: other.name, short: shortName(other.name), ageGroup: other.ageGroup, ice: other.ice, practiceMinutes: other.practiceMinutes, newDrillsPerWeek: other.newDrillsPerWeek, gear: other.gear, groups: other.groups }
      : null,
    mates: mates.map((c) => ({ name: c.firstName ?? editorLabel(c.email), email: c.email })),
    fallbackDate: guess,
  };
  return <Wizard ctx={ctx} />;
}

/** "Nanaimo U7 Avalanche" → "Avalanche", for "like your Avalanche". */
function shortName(name: string): string {
  const words = name.replace(/\b(U\s?-?\d+|Nanaimo)\b/gi, '').trim().split(/\s+/).filter(Boolean);
  return words.length ? words.join(' ') : name;
}
