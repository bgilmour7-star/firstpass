import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AppHeader } from '@/components/app-header';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireUser();
  const team = await (await getAppStore()).myTeam(coach.id);
  return (
    <div className="min-h-dvh">
      <AppHeader email={coach.email} isAdmin={coach.isAdmin} local={coach.local} teamName={team?.name} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
