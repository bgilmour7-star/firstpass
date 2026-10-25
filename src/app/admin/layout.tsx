import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppShell } from '@/components/app-shell';
import { NAV_COOKIE } from '@/lib/nav';
import { navPractice } from '@/lib/nav-practice';
import { getRequestStore } from '@/lib/requests/store';
import { AdminTabs } from './tabs';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const store = await getAppStore();
  const [team, jar] = await Promise.all([store.myTeam(admin.id), cookies()]);
  // Admins: coaches' requests Claude has drafted, waiting for review (decision 0018).
  const reviewCount = (await getRequestStore().then((r) => r.all()).catch(() => [])).filter((r) => r.state === 'drafted').length;
  const next = navPractice(team ? await store.listPractices(team.id).catch(() => []) : []);
  return (
    <AppShell email={admin.email} isAdmin local={admin.local} teamName={team?.name} next={next} reviewCount={reviewCount} analytics={admin.analytics} initialCollapsed={jar.get(NAV_COOKIE)?.value === 'collapsed'}>
      {/* Brett's pages: Analytics, Survey, Coaches, Emails (decision 0027). */}
      {admin.analytics && <AdminTabs />}
      {children}
    </AppShell>
  );
}
