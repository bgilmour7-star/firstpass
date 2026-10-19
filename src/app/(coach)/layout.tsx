import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';
import { navPractice } from '@/lib/nav-practice';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireUser();
  const store = await getAppStore();
  const [team, jar] = await Promise.all([store.myTeam(coach.id), cookies()]);
  const next = navPractice(team ? await store.listPractices(team.id).catch(() => []) : []);
  return (
    <AppShell email={coach.email} isAdmin={coach.isAdmin} local={coach.local} teamName={team?.name} next={next} initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}>
      {children}
    </AppShell>
  );
}
