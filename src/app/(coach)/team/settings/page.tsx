import { headers } from 'next/headers';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { weeklySlots } from '@/lib/plans/team-summary';
import { todayLocal } from '@/lib/calendar/sync';
import { levelSetFor } from '@/lib/progress/levels';
import { getProgressStore } from '@/lib/progress/store';
import { TeamSettings } from '../settings';

export const dynamic = 'force-dynamic';

// Team settings (decision 0031): what everyone on the team shares. Head coaches edit, one section at a
// time in a drawer (0026); other coaches read. Saving goes through the same actions and RLS as before.
export default async function TeamSettingsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { coach, team } = await requireTeam('/team/settings');
  const { edit } = await searchParams;
  const store = await getAppStore();
  const today = todayLocal();
  const [cal, coaches, joinCode, ice] = await Promise.all([store.calendar(team.id), store.coaches(team.id), store.joinCode(team.id), store.iceTimes(team.id).catch(() => [])]);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const isHead = coaches.some((c) => c.userId === coach.id && c.role === 'head_coach');
  // Who scores team progress (decision 0030), for teams whose age group has level descriptions.
  const scoring = levelSetFor(team.ageGroup) ? await (await getProgressStore()).scoringFlags(team.id).catch(() => ({})) : undefined;

  return (
    <TeamSettings
      team={team}
      me={coach.id}
      isHead={isHead}
      scoring={scoring}
      coaches={coaches}
      joinCode={joinCode}
      origin={origin}
      calendar={cal ? { url: cal.url, syncedAt: cal.syncedAt } : null}
      slots={weeklySlots(ice, today)}
      icePractices={ice.filter((x) => x.kind === 'practice' && !x.cancelled && x.date >= today).length}
      initialEdit={edit ?? null}
    />
  );
}
