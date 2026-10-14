import { requireAdmin } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <AppHeader email={admin.email} isAdmin local={admin.local} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
