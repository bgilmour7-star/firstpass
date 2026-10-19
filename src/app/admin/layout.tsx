import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [team, jar] = await Promise.all([(await getAppStore()).myTeam(admin.id), cookies()]);
  const day = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', day: 'numeric' }));
  return (
    <AppShell email={admin.email} isAdmin local={admin.local} teamName={team?.name} todayDay={day} initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}>
      {children}
    </AppShell>
  );
}
