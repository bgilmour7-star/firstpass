import { cookies } from 'next/headers';
import { activeTeam, requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE, TEAM_COOKIE } from '@/lib/nav';
import { navPractice } from '@/lib/nav-practice';
import { getRequestStore } from '@/lib/requests/store';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireUser();
  const store = await getAppStore();
  const jar = await cookies();
  // Every team the coach is on for the switcher, and the active one (decision 0026).
  const [teams, team] = await Promise.all([store.myTeams(coach.id).catch(() => []), activeTeam(store, coach.id, jar.get(TEAM_COOKIE)?.value)]);
  // Admins: coaches' requests Claude has drafted, waiting for review (decision 0018).
  const reviewCount = coach.isAdmin ? (await getRequestStore().then((r) => r.all()).catch(() => [])).filter((r) => r.state === 'drafted').length : 0;
  const next = navPractice(team ? await store.listPractices(team.id).catch(() => []) : []);
  return (
    <AppShell
      email={coach.email}
      isAdmin={coach.isAdmin}
      local={coach.local}
      teamName={team?.name}
      teams={teams.map((t) => ({ id: t.id, name: t.name, ageGroup: t.ageGroup, role: t.role }))}
      activeTeamId={team?.id}
      next={next}
      reviewCount={reviewCount}
      analytics={coach.analytics}
      initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}
    >
      {children}
    </AppShell>
  );
}
