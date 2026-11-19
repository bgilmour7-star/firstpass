import Link from 'next/link';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../../../design-system/index';
import puckParty from '../../../../content/drills/rotation-puck-party.json';
import skillDoctor from '../../../../content/drills/warmup-skill-doctor-tag.json';
import treasure from '../../../../content/drills/game-steal-the-treasure.json';
import copsAndRobbers from '../../../../content/drills/cops-and-robbers.json';
import { ContentFrame, ctaOnTeal, prose } from '@/components/content/content-frame';
import { StartLink } from '@/components/landing/start-link';
import { ANSWER_PAGES, hubFor } from '@/lib/content/pages';
import { answerMetadata, answerStructuredData } from '@/lib/content/meta';

// Answer page: "How do I run my first U7 hockey practice?" (decision 0038, the pilot). Words are
// Brett's (my-writing-style), from his own first practices. The plan is built from library drills;
// the diagram is drawn on the server by RinkDiagram.

const page = ANSWER_PAGES.find((p) => p.path === '/u7/first-practice')!;
const hub = hubFor('U7');

export const metadata = answerMetadata(page);

const RD = firstpass.RinkDiagram as RinkDiagramApi;
const spec = puckParty.diagram as unknown as RinkDiagramProps;
const zones = puckParty.zones as { station: string; name: string }[];
const diagram = RD.render({
  ...spec,
  stations: { ...spec.stations!, labels: ['Finger count', 'Push and chase', 'Glides'] },
  title: `Three stations on half ice, one group at each: ${zones.map((z) => `${z.station}, ${z.name}`).join('. ')}.`,
  detail: 'full',
});

// Live library drills only (src/lib/content/public-drills.ts); names come from the drill files.
const PLAN: { at: string; what: string; who: string }[] = [
  { at: '0:00', what: 'Free skate. Every coach says hi to every kid.', who: 'Everyone' },
  { at: '0:05', what: `${skillDoctor.funName}, a tag game to warm up`, who: 'Everyone' },
  { at: '0:13', what: 'Split into 3 groups and go to your first station', who: 'Groups' },
  { at: '0:15', what: `${puckParty.funName}: 3 stations, groups move on the whistle`, who: 'One coach per station' },
  { at: '0:33', what: 'Water', who: 'Everyone' },
  { at: '0:36', what: treasure.funName, who: 'Everyone' },
  { at: '0:46', what: `${copsAndRobbers.funName} (or whatever game they love)`, who: 'Everyone' },
  { at: '0:56', what: 'Huddle and high fives', who: 'Everyone' },
];

export default function FirstPractice() {
  return (
    <ContentFrame data={answerStructuredData(page, hub)}>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-200">
        <Link href="/u7" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
          U7 practice help
        </Link>
      </nav>

      <h1 className="mt-3 font-display text-[clamp(36px,5.5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.03em]">{page.question}</h1>

      <p className="mt-6 text-[19px] leading-[1.6]">
        Keep it simple. Start with a game, then 3 short stations with one coach at each, and finish with a game. With 10 to 14 kids and 3 coaches on half ice, split them into 3 groups of 3 to 5 and move each group to the next station on the whistle. Explain each activity in under 30 seconds, show it, and switch to a game when their energy drops.
      </p>

      <h2 className={prose.h2}>The plan</h2>
      <p className={prose.p}>This is the 60-minute plan I&apos;d hand a new coach for their first practice. Every block is short, and most of it is games.</p>

      <ol className="mt-5 flex flex-col divide-y divide-border-100 rounded-2xl border border-border-100">
        {PLAN.map((b) => (
          <li key={b.at} className="grid grid-cols-[52px_1fr] gap-x-3 px-4 py-3 sm:grid-cols-[60px_1fr_auto]">
            <span className="font-mono text-[15px] text-ink-200">{b.at}</span>
            <span className="text-[16px] leading-snug">{b.what}</span>
            <span className="col-start-2 text-[13px] text-ink-200 sm:col-start-3 sm:text-right">{b.who}</span>
          </li>
        ))}
      </ol>

      <figure className="mt-8">
        <div className="rink-frame overflow-hidden rounded-2xl border border-border-100 bg-surface-200 p-3" dangerouslySetInnerHTML={{ __html: diagram }} />
        <figcaption className="mt-3 text-[15px] leading-[1.5] text-ink-200">
          {puckParty.funName} on half ice. A: move the puck side to side and call out how many fingers the coach holds up. B: push the puck ahead and chase it. C: glide on one foot with a deep knee bend. Groups move to the next letter on the whistle.
        </figcaption>
      </figure>

      <div className="mt-8 rounded-2xl bg-surface-200 p-5">
        <p className="font-display text-[19px] font-bold">Have a plan B</p>
        <p className="mt-2 text-[16px] leading-[1.6]">If kids are lying on the ice or drifting off, drop whatever is next and play a tag game they already know. You can come back to the skill later.</p>
      </div>

      <h2 className={prose.h2}>What happened at our first practice</h2>
      <p className={prose.p}>
        We did a lot of skating, and some drills went long. Some kids got tired and lay down on the ice. Others got bored and started doing their own thing.
      </p>
      <p className={prose.p}>
        Explaining a drill on the ice was hard. We were yelling over the noise and demoing it while trying to get them to pay attention. When they started, only a few actually knew what was going on.
      </p>

      <h2 className={prose.h2}>What made the good practices work</h2>
      <ul className={prose.ul}>
        <li>Drills they already knew and could jump right into. We keep most of the practice the same each week and add only 1 or 2 new things.</li>
        <li>Names that spark their imagination. Kids will play {treasure.funName} all day. They won&apos;t do &quot;edge work&quot; for long.</li>
        <li>A coach at each station or line, keeping kids on task and cheering them on.</li>
        <li>Watching their energy, so we knew when to switch things up. Our plan B swapped anything technical for something fun.</li>
      </ul>

      <h2 className={prose.h2}>If your situation is different</h2>
      <ul className={prose.ul}>
        <li>Only 2 coaches: run 2 stations of about 10 minutes each, and do the games all together.</li>
        <li>Sharing the ice with another team: play the team on the other half for part of the practice. Kids love it, and it&apos;s easy to run.</li>
      </ul>

      <h2 className={prose.h2}>What I&apos;d tell a parent on their first day</h2>
      <p className={prose.p}>
        Be patient, and don&apos;t expect them to be fully engaged. Bring your energy up so they keep theirs up. Show, don&apos;t tell, when you explain an exercise. And keep it simple. Less is more.
      </p>

      <section aria-labelledby="cta-title" className="band-teal mt-12 rounded-2xl p-[clamp(20px,4vw,32px)] text-white">
        <h2 id="cta-title" className="font-display text-[clamp(24px,3vw,30px)] font-bold leading-tight">Get this plan timed to your ice</h2>
        <p className="mt-3 text-[17px] leading-[1.6] text-white/85">Firstpass builds each practice for your ice time and your skill groups, ready on your phone at the rink. Your first team is free.</p>
        <StartLink className={`${ctaOnTeal} mt-5`} />
      </section>

      <p className="mt-10 border-t border-border-100 pt-5 text-[15px] leading-[1.5] text-ink-200">
        Written by Brett, a U7 coach in Nanaimo, BC. Last checked against our practices on November 19, 2026.{' '}
        <Link href="/u7" className="text-rink-100 underline underline-offset-2">
          More U7 practice help
        </Link>
      </p>
    </ContentFrame>
  );
}
