import { requireTeam } from '@/lib/auth';
import { TeamForm } from './form';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { team } = await requireTeam('/team');
  const { welcome } = await searchParams;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{welcome ? 'Your team is set up' : 'Team'}</h1>
        <p className="text-sm text-ink-200">
          {welcome ? 'Check these defaults, then plan your first practice.' : 'These shape every new plan: group rotation, stations and length.'}
        </p>
      </div>
      <TeamForm team={team} welcome={Boolean(welcome)} />
    </div>
  );
}
