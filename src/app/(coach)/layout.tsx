import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';
import { navPractice } from '@/lib/nav-practice';
import { getRequestStore } from '@/lib/requests/store';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireUser();
  const store = await getAppStore();
  const [team, jar] = await Promise.all([store.myTeam(coach.id), cookies()]);
  // Admins: coaches' requests Claude has drafted, waiting for review (decision 0018).
  const reviewCount = coach.isAdmin ? (await getRequestStore().then((r) => r.all()).catch(() => [])).filter((r) => r.state === 'drafted').length : 0;
  const next = navPractice(team ? await store.listPractices(team.id).catch(() => []) : []);
  return (
    <AppShell email={coach.email} isAdmin={coach.isAdmin} local={coach.local} teamName={team?.name} next={next} reviewCount={reviewCount} initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}>
      {children}
    </AppShell>
  );
}
