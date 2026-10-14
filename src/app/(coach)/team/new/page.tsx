import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { createTeam } from '../actions';

export default async function NewTeam({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const coach = await requireUser('/team/new');
  if (await (await getAppStore()).myTeam(coach.id)) redirect('/plans');
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Name your team</h1>
        <p className="text-sm text-ink-200">You can set group sizes and practice length next. Team details only: never kids&apos; names.</p>
      </div>
      <form action={createTeam} className="flex flex-col gap-3">
        <label htmlFor="name" className="text-xs font-semibold text-ink-200">
          Team name
        </label>
        <input id="name" name="name" required maxLength={80} placeholder="e.g. Nanaimo U7 Blue" className="rounded-md border border-border-100 bg-surface-100 px-3 py-2.5" />
        {error && <p className="text-sm text-flag-100">Give the team a name.</p>}
        <button type="submit" className="min-h-11 rounded-full bg-rink-100 text-sm font-medium text-surface-100 hover:bg-rink-200">
          Create team
        </button>
      </form>
    </div>
  );
}
