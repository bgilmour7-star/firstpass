import Link from 'next/link';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../../../design-system/index';
import hotPotato from '../../../../content/drills/hot-potato-partners.json';
import puckParty from '../../../../content/drills/rotation-puck-party.json';
import skillDoctor from '../../../../content/drills/warmup-skill-doctor-tag.json';
import treasure from '../../../../content/drills/game-steal-the-treasure.json';
import copsAndRobbers from '../../../../content/drills/cops-and-robbers.json';
import { ContentFrame, ctaOnTeal, prose } from '@/components/content/content-frame';
import { PlanTable, totalOf, type PlanRow } from '@/components/content/plan-table';
import { StartLink } from '@/components/landing/start-link';
import { ANSWER_PAGES, hubFor } from '@/lib/content/pages';
import { answerMetadata, answerStructuredData } from '@/lib/content/meta';

// Answer page: "How do I keep 6-year-olds listening on the ice?" (decision 0038). Words are Brett's
// (my-writing-style), from his answers on 2026-11-19. Live library drills only (public-drills.ts); names and
// minutes come from the drill files.

const page = ANSWER_PAGES.find((p) => p.path === '/u7/keep-kids-listening')!;
const hub = hubFor('U7');

export const metadata = answerMetadata(page);

const RD = firstpass.RinkDiagram as RinkDiagramApi;
// Level names as library steps, in sentence case ("Stationary Passes" → "Stationary passes").
const ladder = [hotPotato.levelName, ...hotPotato.levels.map((l) => l.name)].map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase());
const diagram = RD.render({
  ...(hotPotato.diagram as unknown as RinkDiagramProps),
  title: `${hotPotato.funName}, first step: partners stand a few strides apart and pass back and forth.`,
  detail: 'full',
});

const PLAN: PlanRow[] = [
  { minutes: 5, what: 'Free skate. Every coach says hi to every kid.', who: 'Everyone' },
  { minutes: skillDoctor.minutes, what: skillDoctor.funName, who: 'Everyone', tag: 'They know it' },
  { minutes: 2, what: 'Split into 3 groups and go to your first station', who: 'Groups' },
  { minutes: puckParty.minutes * 3, what: `${puckParty.funName}: 3 stations, groups move on the whistle`, who: 'One coach per station', tag: 'They know it' },
  { minutes: 3, what: 'Water', who: 'Everyone' },
  { minutes: hotPotato.minutes, what: `${hotPotato.funName}, starting with the first step`, who: 'Pairs, a coach with each group', tag: 'New' },
  { minutes: treasure.minutes, what: treasure.funName, who: 'Everyone', tag: 'They know it' },
  { minutes: copsAndRobbers.minutes, what: copsAndRobbers.funName, who: 'Everyone', tag: 'They know it' },
  { minutes: 4, what: 'Huddle and high fives', who: 'Everyone' },
];
if (totalOf(PLAN) !== 60) throw new Error(`The keep-kids-listening plan is ${totalOf(PLAN)} minutes, not 60.`);

export default function KeepKidsListening() {
  return (
    <ContentFrame data={answerStructuredData(page, hub)}>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-200">
        <Link href="/u7" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
          U7 practice help
        </Link>
      </nav>

      <h1 className="mt-3 font-display text-[clamp(36px,5.5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.03em]">{page.question}</h1>

      <p className="mt-6 text-[19px] leading-[1.6]">
        Keep the talking to 20 to 30 seconds, then show it. A coach demos, then send out a kid who understands, or at least says they do. Give them a signal they know: a raised stick shows where to go, and three short whistles and a long one means stop and look. And keep new drills to a minimum, so most of the practice is stuff they already know.
      </p>

      <h2 className={prose.h2}>Get their attention</h2>
      <p className={prose.p}>
        Raise your stick like a flag. It shows them where to go without yelling over the noise. When you need a bit more impact, use the whistle. Three short blasts and a long one will get anyone&apos;s attention.
      </p>

      <h2 className={prose.h2}>Explain it in 30 seconds or less</h2>
      <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6 text-[17px] leading-[1.6]">
        <li>Say what to do. Keep it to 20 to 30 seconds, the window that works for our kids.</li>
        <li>Demo it, or have another coach demo it.</li>
        <li>Send a kid who understands first. The rest follow.</li>
      </ol>

      <h2 className={prose.h2}>The plan: one new thing, the rest they know</h2>
      <p className={prose.p}>
        Keeping the number of new drills to a minimum makes things easier for everyone, and avoids kids and coaches feeling overwhelmed. Here&apos;s a 60-minute half-ice plan with one new drill, for 10 to 14 kids and 3 coaches.
      </p>

      <PlanTable rows={PLAN} />

      <figure className="mt-8">
        <div className="rink-frame overflow-hidden rounded-2xl border border-border-100 bg-surface-200 p-3" dangerouslySetInnerHTML={{ __html: diagram }} />
        <figcaption className="mt-3 text-[15px] leading-[1.5] text-ink-200">
          The new drill, {hotPotato.funName}, starts at the first step: partners stand a few strides apart and pass back and forth. Once they&apos;ve got it, climb the ladder.
        </figcaption>
      </figure>

      <h2 className={prose.h2}>When a drill falls apart</h2>
      <p className={prose.p}>Do it a second time. That alone usually helps. If it still isn&apos;t working, simplify the drill, then build back up a step at a time, like climbing a ladder. For {hotPotato.funName}:</p>
      <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6 text-[17px] leading-[1.6]">
        {ladder.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2 className={prose.h2}>The kid lying on the ice</h2>
      <p className={prose.p}>
        Get down to their level and connect with them first (&quot;I&apos;m so tired too&quot;). Then give them a challenge, or give them a job.
      </p>

      <section aria-labelledby="cta-title" className="band-teal mt-12 rounded-2xl p-[clamp(20px,4vw,32px)] text-white">
        <h2 id="cta-title" className="font-display text-[clamp(24px,3vw,30px)] font-bold leading-tight">
          Plans that keep most of the practice familiar
        </h2>
        <p className="mt-3 text-[17px] leading-[1.6] text-white/85">Firstpass plans each practice for your ice time and your skill groups, ready on your phone at the rink. Free for every team this season.</p>
        <StartLink className={`${ctaOnTeal} mt-5`} />
      </section>

      <p className="mt-10 border-t border-border-100 pt-5 text-[15px] leading-[1.5] text-ink-200">
        Written by Brett, a U7 coach in Nanaimo, BC. Last checked against our practices on November 19, 2026.{' '}
        <Link href="/u7" className="inline-flex min-h-11 items-center text-rink-100 underline underline-offset-2">
          More U7 practice help
        </Link>
      </p>
    </ContentFrame>
  );
}
