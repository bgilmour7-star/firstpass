import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';
import { navPractice } from '@/lib/nav-practice';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const store = await getAppStore();
  const [team, jar] = await Promise.all([store.myTeam(admin.id), cookies()]);
  const next = navPractice(team ? await store.listPractices(team.id).catch(() => []) : []);
  return (
    <AppShell email={admin.email} isAdmin local={admin.local} teamName={team?.name} next={next} initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}>
      {children}
    </AppShell>
  );
}
