import Link from 'next/link';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../../../design-system/index';
import merryGoRound from '../../../../content/drills/warmup-merry-go-round.json';
import edgesAndPucks from '../../../../content/drills/rotation-edges-and-pucks.json';
import keepAway from '../../../../content/drills/keep-away-circle.json';
import copsAndRobbers from '../../../../content/drills/cops-and-robbers.json';
import { ContentFrame, ctaOnTeal, prose } from '@/components/content/content-frame';
import { PlanTable, totalOf, type PlanRow } from '@/components/content/plan-table';
import { StartLink } from '@/components/landing/start-link';
import { ANSWER_PAGES, hubFor } from '@/lib/content/pages';
import { answerMetadata, answerStructuredData } from '@/lib/content/meta';

// Answer page: "How do I run stations on half ice?" (decision 0038). Words are Brett's (my-writing-style), from
// his answers on 2026-11-20. Live library drills only (public-drills.ts); names, minutes, zones and group versions
// come from the drill files.

const page = ANSWER_PAGES.find((p) => p.path === '/u7/stations-half-ice')!;
const hub = hubFor('U7');

export const metadata = answerMetadata(page);

const RD = firstpass.RinkDiagram as RinkDiagramApi;
const zones = edgesAndPucks.zones as { station: string; name: string }[];
const rotation = RD.render({
  ...(edgesAndPucks.diagram as unknown as RinkDiagramProps),
  title: `${edgesAndPucks.funName}: half ice in three zones. ${zones.map((z) => `${z.station}, ${z.name}`).join('. ')}.`,
  detail: 'full',
});
const versions = keepAway.stations as { group: string; station: string; version: string }[];
// No group names on the public diagram: each station shows its version, so nothing reads as a ranking.
const keepAwaySpec = keepAway.diagram as unknown as RinkDiagramProps;
const grouped = RD.render({
  ...keepAwaySpec,
  stations: keepAwaySpec.stations ? { ...keepAwaySpec.stations, groups: undefined } : undefined,
  title: `${keepAway.funName} at three stations, a version for each group. ${versions.map((v) => v.version).join(' ')}`,
  detail: 'full',
});

const PLAN: PlanRow[] = [
  { minutes: 5, what: 'Free skate. Every coach says hi to every kid.', who: 'Everyone' },
  { minutes: merryGoRound.minutes, what: `${merryGoRound.funName}, laps with a skill on the long side`, who: 'Everyone' },
  { minutes: 2, what: 'Split into 3 groups and go to your first station', who: 'Groups' },
  { minutes: edgesAndPucks.minutes * 3, what: `${edgesAndPucks.funName}: 3 stations, rotate clockwise on the whistle`, who: 'One coach per station, mixed groups' },
  { minutes: 3, what: 'Water', who: 'Everyone' },
  { minutes: keepAway.minutes, what: `${keepAway.funName}: each skill group at its own station`, who: 'One coach per group, grouped by skill' },
  { minutes: copsAndRobbers.minutes, what: copsAndRobbers.funName, who: 'Everyone' },
  { minutes: 5, what: 'Huddle and high fives', who: 'Everyone' },
];
if (totalOf(PLAN) !== 60) throw new Error(`The stations plan is ${totalOf(PLAN)} minutes, not 60.`);

export default function StationsHalfIce() {
  return (
    <ContentFrame data={answerStructuredData(page, hub)}>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-200">
        <Link href="/u7" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
          U7 practice help
        </Link>
      </nav>

      <h1 className="mt-3 font-display text-[clamp(36px,5.5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.03em]">{page.question}</h1>

      <p className="mt-6 text-[19px] leading-[1.6]">
        Split the half ice into 2 or 3 zones, put one coach in each, and rotate the groups clockwise on the whistle. 2 or 3 stations splits a team of 12 to 16 into groups of 4 to 6, where kids don&apos;t get lost in the crowd. Group kids with others at a similar level when a drill builds step by step, and never run more stations than you have coaches, especially at U7.
      </p>

      <h2 className={prose.h2}>Why stations work</h2>
      <p className={prose.p}>
        Smaller groups mean more skating, more puck touches and more coach attention. That&apos;s been great for keeping our kids engaged and helping them learn new skills at their level. 2 or 3 zones gives the kids and the coaches the space they need for almost any skill-building activity.
      </p>

      <figure className="mt-8">
        <div className="rink-frame overflow-hidden rounded-2xl border border-border-100 bg-surface-200 p-3" dangerouslySetInnerHTML={{ __html: rotation }} />
        <figcaption className="mt-3 text-[15px] leading-[1.5] text-ink-200">
          Half ice in three zones, from {edgesAndPucks.funName}. {zones.map((z) => `${z.station}: ${z.name.toLowerCase()}`).join('. ')}. Groups move to the next zone on the whistle.
        </figcaption>
      </figure>

      <h2 className={prose.h2}>Moving between stations</h2>
      <ul className={prose.ul}>
        <li>Blow the whistle.</li>
        <li>Every group rotates clockwise to the next station.</li>
        <li>Each coach either goes with their group or points them to the next station.</li>
      </ul>
      <p className={prose.p}>
        Going with your group is worth it when kids tend to drift between stations. Someone who knows them is always there, and you see how each kid does at every station.
      </p>

      <h2 className={prose.h2}>The plan</h2>
      <p className={prose.p}>A 60-minute half-ice plan for 12 to 16 kids and 3 coaches, with one station rotation and one block in skill groups.</p>

      <PlanTable rows={PLAN} />

      <h2 className={prose.h2}>Mixed groups or skill groups?</h2>
      <p className={prose.p}>
        Both have a place. Mixed groups work well for games and simple skills, where kids pick things up from each other. When a drill builds step by step, kids do better with others at a similar level, so everyone gets a challenge they can win.
      </p>
      <p className={prose.p}>
        The first time we ran stations, we mixed every level in a drill that built on itself. The kids further along weren&apos;t challenged, and the kids still learning felt overwhelmed. Being thoughtful about when to group by skill, and when not to, makes a big difference in what they get out of a drill.
      </p>
      <p className={prose.p}>
        In the plan above, the rotation is mixed. {keepAway.funName} is in skill groups: every group plays the same game, with a version that fits.
      </p>

      <figure className="mt-6">
        <div className="rink-frame overflow-hidden rounded-2xl border border-border-100 bg-surface-200 p-3" dangerouslySetInnerHTML={{ __html: grouped }} />
        <figcaption className="mt-3 text-[15px] leading-[1.5] text-ink-200">
          {keepAway.funName}, one station per group, the same game at each: {versions.map((v) => v.version.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())).join('; ')}.
        </figcaption>
      </figure>

      <h2 className={prose.h2}>Keep skill groups kind</h2>
      <ul className={prose.ul}>
        <li>Give the groups fun names that don&apos;t rank them. Ours are animals. Never call one the top or bottom group.</li>
        <li>Every group plays the same game or drill, with a version that fits. Same fun, different challenge.</li>
        <li>Every group gets a coach and the same energy. Put your most patient coach with the kids who need the most support.</li>
        <li>Groups aren&apos;t fixed. Kids grow fast at this age, so look again every few weeks and move them when they&apos;re ready.</li>
        <li>If a parent asks, keep it simple: every kid gets a challenge at their level.</li>
      </ul>

      <h2 className={prose.h2}>With only 2 coaches</h2>
      <p className={prose.p}>
        Limit the number of stations to the number of coaches you have, especially for U7. Two coaches means two stations. At U9 and up, you can probably get away with one coach running two groups.
      </p>

      <section aria-labelledby="cta-title" className="band-teal mt-12 rounded-2xl p-[clamp(20px,4vw,32px)] text-white">
        <h2 id="cta-title" className="font-display text-[clamp(24px,3vw,30px)] font-bold leading-tight">
          Stations planned for your coaches and your ice
        </h2>
        <p className="mt-3 text-[17px] leading-[1.6] text-white/85">Firstpass splits every practice into stations for the coaches you have, with a version of each drill for every skill group. Your first team is free.</p>
        <StartLink className={`${ctaOnTeal} mt-5`} />
      </section>

      <p className="mt-10 border-t border-border-100 pt-5 text-[15px] leading-[1.5] text-ink-200">
        Written by Brett, a U7 coach in Nanaimo, BC. Last checked against our practices on November 20, 2026.{' '}
        <Link href="/u7" className="text-rink-100 underline underline-offset-2">
          More U7 practice help
        </Link>
      </p>
    </ContentFrame>
  );
}
