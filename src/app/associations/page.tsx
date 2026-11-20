import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentFrame, prose } from '@/components/content/content-frame';
import { AssociationForm } from '@/components/landing/association-form';
import { SITE } from '@/lib/site/public-pages';
import {
  ASSOCIATION_TIERS,
  FOUNDING_PRICE,
  FOUNDING_SEASONS,
  LOWEST_ASSOCIATION_PRICE,
  PAID_FROM,
  TEAM_PRICE,
  TRIAL_PRACTICES,
  perPlayer,
  rateFor,
  savingPct,
  tierLabel,
} from '@/lib/site/pricing';

// The associations page (decision 0043, option B): what an association gets, the volume price it passes on to
// every team, the founding offer, and "Talk to Brett" (the association form, rows land in the waitlist table
// as kind 'association'). Design from the canvas "Firstpass associations page". The association tools aren't
// built yet, so the page says so plainly. Team progress reports never go to associations (decision 0030).

const PATH = '/associations';
const TITLE = 'Firstpass for minor hockey associations';
const DESCRIPTION = `Every U5–U9 team planning the same way, from $${LOWEST_ASSOCIATION_PRICE} per team a season. Free for every team this season. See all your teams, set up coaches, and pay as one association or team by team.`;
const UPDATED = '2026-11-20';

const HIGHEST_ASSOCIATION_PRICE = Math.max(...ASSOCIATION_TIERS.flatMap((t) => (t.price === null ? [] : [t.price])));

const EXAMPLE_TEAMS = 12;
const exampleRate = rateFor(EXAMPLE_TEAMS)!;
const exampleSaved = EXAMPLE_TEAMS * (TEAM_PRICE - exampleRate);

const FAQ = [
  {
    q: 'When does pricing start?',
    a: `The ${PAID_FROM} season. Every team is free until then, so your coaches can plan real practices before you decide anything.`,
  },
  {
    q: 'Do coaches pay?',
    a: `Never out of their own pocket. From ${PAID_FROM}, a new team gets its first ${TRIAL_PRACTICES} practices free. Then the team pays from its budget, or the association covers it.`,
  },
  {
    q: 'Some of our teams already use Firstpass. What do they pay?',
    a: `Teams planning in Firstpass this season are founding teams. They lock in $${FOUNDING_PRICE} a team for ${FOUNDING_SEASONS} seasons, the same as a founding association.`,
  },
  {
    q: 'Do parents or players pay?',
    a: 'No. Parents open the practice plan from a link. No app, no sign-in and no cost, for every family on the team.',
  },
  {
    q: 'What does the association see?',
    a: 'Which teams are planning and how many practices each has run. Coaches’ notes and their team’s progress scores stay with the team’s coaches.',
  },
  {
    q: 'Where is our data kept?',
    a: 'In Canada. Firstpass never stores kids’ names, photos or birthdates. Teams use skill groups and counts only.',
  },
  {
    q: 'What age groups does it cover?',
    a: 'U5 to U9. Drills are built for small-area, station-based practices on half ice.',
  },
];

export const metadata: Metadata = {
  title: `${TITLE} · Firstpass`,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}${PATH}`,
    siteName: 'Firstpass',
    type: 'website',
    locale: 'en_CA',
    images: [{ url: `${SITE}/og/firstpass-landing.png`, width: 1200, height: 630, alt: 'Firstpass: practice plans for U5–U9 hockey.' }],
  },
};

const data = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE}${PATH}`,
      dateModified: UPDATED,
      inLanguage: 'en-CA',
      publisher: { '@id': `${SITE}/#organization` },
      about: { '@id': `${SITE}/#app` },
    },
    {
      '@type': 'Product',
      name: 'Firstpass for associations',
      description: DESCRIPTION,
      brand: { '@id': `${SITE}/#organization` },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'CAD',
        lowPrice: LOWEST_ASSOCIATION_PRICE,
        highPrice: HIGHEST_ASSOCIATION_PRICE,
        description: `Per team, per season, from the ${PAID_FROM} season, by number of U5–U9 teams`,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Firstpass', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Associations', item: `${SITE}${PATH}` },
      ],
    },
  ],
};

// Stroke icons, drawn inline (no icon set in the app yet). Decorative: each card's heading says it.
const ICONS = {
  teams: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  coaches: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  price: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  bill: (
    <>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
};

const GETS: { icon: keyof typeof ICONS; title: string; body: string }[] = [
  { icon: 'teams', title: 'See every team', body: 'Who’s planning, practices run, and which teams need a hand.' },
  { icon: 'coaches', title: 'Set up teams and coaches', body: 'Create teams, invite coaches, and move them when rosters change.' },
  { icon: 'price', title: 'Every team pays less', body: `$${ASSOCIATION_TIERS[0].price} or $${LOWEST_ASSOCIATION_PRICE} a team instead of $${TEAM_PRICE}. Custom rates at 25+ teams.` },
  { icon: 'bill', title: 'One bill or team by team', body: 'Pay as one, or each team pays its share at the same rate.' },
];

const COACHES = [
  'A plan for every practice, timed to your ice and split for your skill groups',
  'Station rotations planned and timed for half ice',
  'Drills from a reviewed library, each one showing where it came from',
  'A link to share the plan with parents, free for every family',
];

export default function AssociationsPage() {
  return (
    <ContentFrame data={data}>
      <p className="text-[15px] font-medium text-rink-100">For associations</p>
      <h1 className="mt-2 font-display text-[clamp(36px,5.5vw,48px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
        Every U5–U9 team, planning the same way
      </h1>
      <p className="mt-5 text-[19px] leading-[1.6]">
        Firstpass gives each of your volunteer coaches a plan for every practice. The association gets a view of all its teams, sets up coaches in one place, and every team pays less. Pay as one bill, or let each team pay its share from its own budget.
      </p>
      <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rink-100 px-[18px] py-3.5 text-base leading-normal">
        <strong className="font-semibold text-rink-200">Free for every team this season.</strong>
        <span className="text-ink-200">Paid plans start in the {PAID_FROM} season.</span>
      </p>

      <h2 className={prose.h2}>What the association gets</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {GETS.map((g) => (
          <li key={g.title} className="flex items-start gap-3.5 rounded-2xl border border-border-100 p-[18px]">
            <span aria-hidden="true" className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-surface-200 text-rink-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[g.icon]}
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-[18px] font-bold leading-tight">{g.title}</h3>
              <p className="text-[15px] leading-normal text-ink-200">{g.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 id="pricing" className={prose.h2}>
        Pricing
      </h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Association price per team">
        {ASSOCIATION_TIERS.map((t, i) => {
          const best = t.price === LOWEST_ASSOCIATION_PRICE;
          return (
            <li key={i} className={`flex flex-col rounded-2xl p-5 ${best ? 'border-2 border-rink-100 bg-surface-200' : 'border border-border-100'}`}>
              <span className="text-[15px] font-medium text-ink-200">{tierLabel(t)}</span>
              {t.price === null ? (
                <>
                  <span className="mt-2 font-display text-[36px] font-extrabold leading-none">Custom</span>
                  <span className="mt-3 text-[15px] leading-normal text-ink-200">For large associations and multi-division setups.</span>
                  <a href="#talk" className="mt-1 inline-flex min-h-11 items-center self-start text-[15px] leading-normal text-rink-100 underline underline-offset-2">Talk to Brett</a>
                </>
              ) : (
                <>
                  <span className="mt-2 font-display text-[36px] font-extrabold leading-none">
                    ${t.price}
                    <span className="ml-1 font-sans text-[15px] font-normal text-ink-200">/ team</span>
                  </span>
                  <span className="mt-3 text-[15px] leading-normal">{perPlayer(t.price)}</span>
                  <span className="mt-1 text-[15px] leading-normal text-ink-200">
                    {savingPct(t.price)}% off the ${TEAM_PRICE} team price
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className={prose.p}>
        Per team, per season, in Canadian dollars, from {PAID_FROM}. A team on its own pays ${TEAM_PRICE} after {TRIAL_PRACTICES} free practices. Through the association, every team pays less: <strong className="font-semibold">{perPlayer(LOWEST_ASSOCIATION_PRICE).toLowerCase()} for the whole season</strong> at the ${LOWEST_ASSOCIATION_PRICE} rate. An association with {EXAMPLE_TEAMS} teams saves its teams ${exampleSaved} a season.
      </p>

      <div className="band-teal mt-5 flex flex-col gap-3 rounded-2xl p-6 text-white">
        <h3 className="font-display text-[24px] font-bold leading-tight">Founding associations</h3>
        <p className="text-[17px] leading-[1.6] text-white/85">
          Every team plans free for the rest of this season. Commit before your {PAID_FROM} budget is set and lock in ${FOUNDING_PRICE} a team or less for {FOUNDING_SEASONS} seasons, whatever your size. You’d also help shape the association tools.
        </p>
        <a href="#talk" className="mt-1 inline-flex min-h-12 items-center self-start rounded-full bg-surface-100 px-6 text-base font-medium text-ink-100 hover:bg-surface-200">
          Ask about a founding spot
        </a>
      </div>

      <h2 className={prose.h2}>What every coach gets</h2>
      <ul className={prose.ul}>
        {COACHES.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className={prose.p}>
        See how it plans a real practice in{' '}
        <Link href="/u7/stations-half-ice" className="inline-flex min-h-11 items-center text-rink-100 underline underline-offset-2">
          How do I run stations on half ice?
        </Link>
      </p>

      <h2 className={prose.h2}>Where it stands</h2>
      <p className={prose.p}>
        Firstpass is in its first season, with coaches in Nanaimo planning practices in it every week. The association view, team setup and billing are being built with our first associations, so you’d help shape them. Until they’re ready, Brett sets up your teams and coaches with you.
      </p>

      <h2 className={prose.h2}>Questions associations ask</h2>
      <dl className="mt-4 flex flex-col">
        {FAQ.map((f) => (
          <div key={f.q} className="border-b border-border-100 py-4">
            <dt className="font-display text-[19px] font-bold leading-tight">{f.q}</dt>
            <dd className="mt-2 text-[17px] leading-[1.6] text-ink-200">{f.a}</dd>
          </div>
        ))}
      </dl>

      <section id="talk" aria-label="Talk to Brett" className="band-teal mt-12 flex scroll-mt-4 justify-center rounded-2xl p-[clamp(16px,4vw,32px)]">
        <AssociationForm />
      </section>

      <p className="mt-10 border-t border-border-100 pt-5 text-[15px] leading-[1.5] text-ink-200">
        Prices checked November 20, 2026. Questions? Email{' '}
        <a href="mailto:hello@firstpass.coach" className="inline-flex min-h-11 items-center text-rink-100 underline underline-offset-2">
          hello@firstpass.coach
        </a>
      </p>
    </ContentFrame>
  );
}
