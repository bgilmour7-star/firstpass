import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentFrame, prose } from '@/components/content/content-frame';
import { AssociationForm } from '@/components/landing/association-form';
import { SITE } from '@/lib/site/public-pages';
import { ASSOCIATION_TIERS, LOWEST_ASSOCIATION_PRICE, TEAM_PRICE, rateFor, savingPct, tierLabel } from '@/lib/site/pricing';

// The associations page (decision 0043): what an association gets, the volume price per team, and
// "Talk to Brett" (the association form, rows land in the waitlist table as kind 'association').
// The association tools aren't built yet, so the page says so plainly. Team progress reports never
// go to associations (decision 0030), so the association view is planning activity only.

const PATH = '/associations';
const TITLE = 'Firstpass for minor hockey associations';
const DESCRIPTION = `Every U5–U9 team planning the same way, from $${LOWEST_ASSOCIATION_PRICE} per team a season. See all your teams, set up coaches, and pay as one association or team by team.`;
const UPDATED = '2026-11-20';

const EXAMPLE_TEAMS = 12;
const exampleRate = rateFor(EXAMPLE_TEAMS)!;
const exampleTotal = EXAMPLE_TEAMS * exampleRate;
const exampleSaved = EXAMPLE_TEAMS * TEAM_PRICE - exampleTotal;

const FAQ = [
  {
    q: 'Can one team try it first?',
    a: 'Yes. A coach’s first team is free, so any coach in your association can plan a few practices before you decide anything.',
  },
  {
    q: 'Do parents or players pay?',
    a: 'No. Parents open the practice plan from a link. No app, no sign-in and no cost, for every family on the team.',
  },
  {
    q: 'What does the association see?',
    a: 'Which teams are planning and how many practices each has run. Coaches’ notes about kids and their progress scores stay with the team’s coaches.',
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
        highPrice: TEAM_PRICE,
        description: 'Per team, per season, by number of U5–U9 teams',
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

const GETS = [
  { title: 'See every team in one place', body: 'Which teams are planning, practices run this month, and which coaches have joined. Spot the team that needs a hand before the season gets away from them.' },
  { title: 'Set up teams and assign coaches', body: 'Create your U5–U9 teams, invite each head coach and assistant, and move a coach when rosters change. Coaches start with their team, ice times and skill groups already in place.' },
  { title: 'A lower price for every team', body: `The more teams you bring, the less each one costs, down to $${LOWEST_ASSOCIATION_PRICE} a season. Associations with 25 or more teams get a custom rate.` },
  { title: 'One bill, or each team pays its share', body: 'Pay as one association, or let each team pay from its own budget at the association rate. Same price either way.' },
];

const COACHES = [
  'A plan for every practice, timed to your ice and split for your skill groups',
  'Stations planned for the number of coaches on the ice',
  'Drills from a reviewed library, each one showing where it came from',
  'A link to share the plan with parents, free for every family',
];

export default function AssociationsPage() {
  return (
    <ContentFrame data={data}>
      <p className="text-[15px] font-medium text-rink-100">For associations</p>
      <h1 className="mt-2 font-display text-[clamp(36px,5.5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
        Every U5–U9 team, planning the same way
      </h1>
      <p className="mt-5 text-[19px] leading-[1.6]">
        Firstpass gives each of your volunteer coaches a plan for every practice. The association gets a view of all its teams, sets up coaches in one place, and pays less per team. Pay as one bill, or let each team pay its share from its own budget.
      </p>

      <h2 className={prose.h2}>What the association gets</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {GETS.map((g) => (
          <li key={g.title} className="rounded-2xl border border-border-100 p-5">
            <h3 className="font-display text-[19px] font-bold leading-tight">{g.title}</h3>
            <p className="mt-2 text-[16px] leading-[1.55] text-ink-200">{g.body}</p>
          </li>
        ))}
      </ul>

      <h2 id="pricing" className={prose.h2}>Pricing</h2>
      <p className={prose.p}>Per team, per season, in Canadian dollars. A team on its own is ${TEAM_PRICE} a season.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Association price per team">
        {ASSOCIATION_TIERS.map((t, i) => {
          const best = t.price === LOWEST_ASSOCIATION_PRICE;
          return (
            <li key={i} className={`flex flex-col rounded-2xl p-5 ${best ? 'border-2 border-rink-100 bg-surface-200' : 'border border-border-100'}`}>
              <span className="text-[15px] font-medium text-ink-200">{tierLabel(t)}</span>
              {t.price === null ? (
                <span className="mt-2 font-display text-[36px] font-extrabold leading-none">Custom</span>
              ) : (
                <span className="mt-2 font-display text-[36px] font-extrabold leading-none">
                  ${t.price}
                  <span className="ml-1 font-sans text-[15px] font-normal text-ink-200">/ team</span>
                </span>
              )}
              <span className="mt-3 text-[15px] leading-[1.5] text-ink-200">
                {t.price === null ? 'For large associations and multi-division setups. Talk to Brett.' : `${savingPct(t.price)}% off the team price`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 rounded-2xl bg-surface-200 p-5 text-[17px] leading-[1.6]">
        <strong className="font-semibold">An association with {EXAMPLE_TEAMS} teams</strong> pays ${exampleRate} a team, ${exampleTotal} for the season instead of ${EXAMPLE_TEAMS * TEAM_PRICE}. That’s ${exampleSaved} back in the budget.
      </p>

      <h2 className={prose.h2}>What every coach gets</h2>
      <ul className={prose.ul}>
        {COACHES.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className={prose.p}>
        See how it plans a real practice in{' '}
        <Link href="/u7/stations-half-ice" className="text-rink-100 underline underline-offset-2">
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

      <section aria-label="Talk to Brett" className="band-teal mt-12 flex justify-center rounded-2xl p-[clamp(16px,4vw,32px)]">
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
