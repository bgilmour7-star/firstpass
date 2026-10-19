import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { createTeam } from '../actions';

// The first setup step after creating an account (decision 0013, canvas "Name your team"):
// name, age group and ice. Groups and practice length come next, on the Team page.
export default async function NewTeam({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const coach = await requireUser('/team/new');
  if (await (await getAppStore()).myTeam(coach.id)) redirect('/plans');
  const { error } = await searchParams;
  const seg = 'inline-flex w-fit gap-1 rounded-full bg-surface-300 p-1';
  const opt = 'inline-flex h-11 cursor-pointer items-center rounded-full px-[22px] text-[15px] font-medium text-ink-200 has-[:checked]:bg-surface-100 has-[:checked]:font-semibold has-[:checked]:text-ink-100 has-[:checked]:shadow-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rink-100/40';
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6 pt-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.02em]">Name your team{coach.local ? '' : `, ${coach.name}`}</h1>
        <p className="text-[15px] text-ink-200">Team details only. Never kids&apos; names.</p>
      </div>
      <form action={createTeam} className="flex flex-col gap-[26px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-semibold">
            Team name
          </label>
          <input id="name" name="name" required maxLength={80} autoFocus placeholder="e.g. Nanaimo U7 Blue" className="h-[52px] rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-4 text-[17px] placeholder:text-ink-200/70 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25" />
          {error && <p className="text-[13px] text-flag-100">Give the team a name.</p>}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Age group</legend>
          <div className={seg}>
            {['U7', 'U9'].map((a) => (
              <label key={a} className={opt}>
                <input type="radio" name="age" value={a} defaultChecked={a === 'U7'} className="sr-only" />
                {a}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Your ice</legend>
          <div className={seg}>
            {(
              [
                ['half', 'Half ice'],
                ['full', 'Full ice'],
                ['varies', 'It changes'],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className={opt}>
                <input type="radio" name="ice" value={v} defaultChecked={v === 'half'} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
          <span className="text-xs text-ink-200">Sets how every drill is drawn. You can change it for one practice later.</span>
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="submit" className="h-[52px] shrink-0 whitespace-nowrap rounded-full bg-rink-100 px-8 font-semibold text-surface-100 hover:bg-rink-200">
            Next: groups
          </button>
          <span className="text-[13px] text-ink-200">Joining a team someone else set up? Open the join link your head coach sent you.</span>
        </div>
      </form>
    </div>
  );
}
