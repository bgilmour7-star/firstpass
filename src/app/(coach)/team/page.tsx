import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { TeamForm } from './form';
import { CalendarSettings } from './calendar';
import { EmailSettings } from './emails';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { coach, team } = await requireTeam('/team');
  const { welcome } = await searchParams;
  const store = await getAppStore();
  const [cal, emails] = await Promise.all([store.calendar(team.id), store.checkinEmails(team.id, coach.id)]);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{welcome ? 'Your team is set up' : 'Team'}</h1>
        <p className="text-sm text-ink-200">
          {welcome ? 'Check these defaults, then plan your first practice.' : 'Your groups and their usual numbers shape every new plan.'}
        </p>
      </div>
      <TeamForm team={team} welcome={Boolean(welcome)} />
      <CalendarSettings initial={cal?.url ?? null} syncedAt={cal?.syncedAt ?? null} />
      {!coach.local && <EmailSettings initial={emails} email={coach.email} />}
    </div>
  );
}
