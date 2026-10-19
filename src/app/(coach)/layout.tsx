import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireUser();
  const [team, jar] = await Promise.all([(await getAppStore()).myTeam(coach.id), cookies()]);
  return (
    <AppShell email={coach.email} isAdmin={coach.isAdmin} local={coach.local} teamName={team?.name} todayDay={todayDay()} initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}>
      {children}
    </AppShell>
  );
}

function todayDay() {
  return Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', day: 'numeric' }));
}
