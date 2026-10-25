import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAnalytics } from '@/lib/auth';
import { SITE } from '@/lib/email/layout';
import { getDiscoveryStore } from '@/lib/discovery/store';
import { NOTE_KIND_LABEL, PLANNED_HOW, PLANNED_WHEN, labelOf, type SurveyResponse } from '@/lib/discovery/schema';
import { describe, displayName, repoPath } from '@/lib/discovery/summary';
import { MigrationMissing, loadDiscovery, shortDay } from '../../survey/load';
import { Themes } from '../../survey/controls';
import { NoteForm } from './note-form';

export const dynamic = 'force-dynamic';

// One person (decision 0027; canvas A2): add a note, the timeline (notes, survey, joined), their
// situation, what they actually do in Firstpass, and the repo file the daily sync writes.

type Item = { at: string; label: string; body: React.ReactNode; muted?: boolean };

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnalytics('/admin/coaches');
  const { id } = await params;
  const { people, responses, notes, themes, usage, missing } = await loadDiscovery();
  if (missing) return <MigrationMissing />;
  const p = people.find((x) => x.id === id);
  if (!p) notFound();
  const mine = responses.filter((r) => r.personId === p.id);
  const myNotes = notes.filter((n) => n.personId === p.id);
  const u = usage.find((x) => x.personId === p.id);
  const team = u?.teams[0];
  const latest: SurveyResponse | undefined = mine[0];
  const token = await (await getDiscoveryStore()).surveyToken(p.id).catch(() => null);
  const name = displayName(p);

  const items: Item[] = [
    ...myNotes.map((n) => ({
      at: n.createdAt,
      label: NOTE_KIND_LABEL[n.kind],
      body: (
        <div className="flex flex-col gap-2">
          <p className="whitespace-pre-line text-[15px] leading-[23px]">{n.body}</p>
          <Themes kind="note" id={n.id} themes={n.themes} known={themes} />
        </div>
      ),
    })),
    ...mine.map((r) => ({
      at: r.createdAt,
      label: r.audience === 'older' ? 'U11+ screen' : 'Survey',
      body: (
        <div className="flex flex-col gap-2">
          {r.hardestPart ? <p className="text-[15px] leading-[23px]">“{r.hardestPart}”</p> : <p className="text-[15px] text-ink-200">Skipped the hardest part.</p>}
          {(r.wantsHelp || r.extra.missing) && <p className="text-sm text-ink-200">{r.audience === 'coach' ? 'Missing' : 'Would help'}: “{r.extra.missing ?? r.wantsHelp}”</p>}
          <span className="text-[13px] text-ink-200">{describe(r)}</span>
          {!r.readOnly && <Themes kind="response" id={r.id} themes={r.themes} known={themes} />}
        </div>
      ),
    })),
    ...(team ? [{ at: team.joinedAt, label: 'Joined', muted: true, body: <p className="text-[15px] leading-[23px] text-ink-200">Joined {team.name} as {team.role === 'head_coach' ? 'head coach' : 'a coach'}.</p> }] : []),
    {
      at: p.createdAt,
      label: p.waitlistId ? 'Waitlist' : 'Account',
      muted: true,
      body: <p className="text-[15px] leading-[23px] text-ink-200">{p.waitlistId ? 'Joined the waitlist.' : 'Created an account.'}</p>,
    },
  ].sort((a, b) => b.at.localeCompare(a.at));

  const subtitle = [team ? (team.role === 'head_coach' ? 'Head coach' : 'Coach') : null, team?.name, p.email, `${p.audience === 'coach' ? 'With Firstpass' : 'On the waitlist'} since ${shortDay(p.createdAt)}`, p.unsubscribedAt ? 'Unsubscribed from survey emails' : null].filter(Boolean).join(' · ');

  return (
    <div className="grid gap-x-10 gap-y-8 pb-16 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Link href="/admin/coaches" className="inline-flex min-h-8 items-center text-[13px] text-rink-100 hover:underline">
            ← All coaches
          </Link>
          <h1 className="break-words text-[32px] font-extrabold leading-9 tracking-[-0.02em]">{name}</h1>
          <p className="break-words text-sm text-ink-200">{subtitle}</p>
        </div>

        <NoteForm personId={p.id} />

        <ol className="flex flex-col">
          {items.map((it, i) => (
            <li key={i} className={`grid gap-2 border-t border-border-100 py-[18px] sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-5 ${i === items.length - 1 ? 'border-b' : ''}`}>
              <div className="flex gap-2 sm:flex-col sm:gap-0.5">
                <span className="font-mono text-[13px] font-medium">{shortDay(it.at)}</span>
                <span className="text-[13px] text-ink-200">{it.label}</span>
              </div>
              {it.body}
            </li>
          ))}
        </ol>
      </div>

      <aside aria-label={`${name}’s situation`} className="flex flex-col gap-5 self-start rounded-xl bg-surface-200 p-6">
        <section className="flex flex-col gap-2.5">
          <h2 className="font-body text-sm font-semibold">Their situation</h2>
          <dl className="grid grid-cols-[96px_1fr] gap-x-2.5 gap-y-2 text-sm">
            {team && (
              <>
                <Row k="Team">{u!.teams.map((t) => t.name).join(', ')}</Row>
                <Row k="Age group">{team.ageGroup}</Row>
                <Row k="Skaters">{team.skaters}</Row>
                <Row k="Coaches">{team.coaches}</Row>
                <Row k="Ice">{team.ice === 'full' ? 'Full ice' : team.ice === 'half' ? 'Half ice' : 'Varies'}</Row>
              </>
            )}
            {latest && !team && latest.ageGroups.length > 0 && <Row k="Age group">{latest.ageGroups.join(', ')}</Row>}
            {latest?.plannedHow && <Row k="Plans today">{[labelOf(PLANNED_HOW, latest.plannedHow), labelOf(PLANNED_WHEN, latest.plannedWhen)?.toLowerCase()].filter(Boolean).join(', ')}</Row>}
            {latest?.wantsCall && <Row k="Call">{latest.callStatus === 'to_book' ? 'Wants one, not booked' : latest.callStatus === 'booked' ? 'Booked' : 'Done'}{latest.phone ? ` · ${latest.phone}` : ''}</Row>}
            {latest && <Row k="Gift card">{latest.giftCard === 'owed' ? 'To send' : latest.giftCard === 'sent' ? 'Sent' : 'Not offered'}</Row>}
            {!team && !latest && <Row k="So far">Nothing but their email</Row>}
          </dl>
        </section>

        <section className="flex flex-col gap-2.5 border-t border-border-100 pt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-body text-sm font-semibold">Using Firstpass</h2>
            {!u && <span className="font-mono text-xs text-ink-200">not yet</span>}
          </div>
          {u ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-2 text-sm">
              <Row k="Practices run" mono>{u.practicesRun}</Row>
              <Row k="Check-ins" mono>{u.checkins}</Row>
              <Row k="Drills swapped" mono>{u.swaps}</Row>
              <Row k="Last active" mono>{u.lastActive ? shortDay(u.lastActive) : '–'}</Row>
            </dl>
          ) : (
            <p className="text-sm leading-5 text-ink-200">Once they’re in, this shows practices run, check-ins, drills swapped and last active, so you can read their answers against what they actually do. Mark them Onboarded on the Analytics waitlist to let them sign up.</p>
          )}
        </section>

        {token && (
          <section className="flex flex-col gap-2 border-t border-border-100 pt-5">
            <h2 className="font-body text-sm font-semibold">Survey link</h2>
            <p className="break-all font-mono text-[13px]">{`${SITE}/s/${token}`}</p>
            <p className="text-[13px] leading-[18px] text-ink-200">To send by hand. It works once.</p>
          </section>
        )}

        <section className="flex flex-col gap-2 border-t border-border-100 pt-5">
          <h2 className="font-body text-sm font-semibold">In the repo</h2>
          <p className="font-mono text-[13px]">{repoPath(p)}</p>
          <p className="text-[13px] leading-[18px] text-ink-200">Synced each morning with their notes, answers and usage. Uses their first name and team, never their email or phone.</p>
        </section>
      </aside>
    </div>
  );
}

function Row({ k, children, mono }: { k: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <dt className="text-ink-200">{k}</dt>
      <dd className={`m-0 ${mono ? 'text-right font-mono' : ''}`}>{children}</dd>
    </>
  );
}
