import { cookies } from 'next/headers';
import { currentTeam, requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';
import { navPractice } from '@/lib/nav-practice';
import { getRequestStore } from '@/lib/requests/store';
import { teamPractices } from '@/lib/app/read';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireUser();
  const store = await getAppStore();
  const jar = await cookies();
  // Every team the coach is on for the switcher, and the active one (decision 0026).
  // currentTeam is cached per request, so the page's requireTeam() reuses it.
  const [teams, team, requests] = await Promise.all([
    store.myTeams(coach.id).catch(() => []),
    currentTeam(coach.id),
    // Admins: coaches' requests Claude has drafted, waiting for review (decision 0018).
    coach.isAdmin ? getRequestStore().then((r) => r.all()).catch(() => []) : Promise.resolve([]),
  ]);
  const reviewCount = requests.filter((r) => r.state === 'drafted').length;
  const next = navPractice(team ? await teamPractices(team.id).catch(() => []) : []);
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
