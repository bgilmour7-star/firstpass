import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentFrame, ctaOnTeal, prose } from '@/components/content/content-frame';
import { StartLink } from '@/components/landing/start-link';
import { SITE } from '@/lib/site/public-pages';

// Comparison page (SEO and AEO plan, task 3; decision 0045): Firstpass against what coaches do today, a
// downloaded PDF and a clipboard, not against other apps. The words are Brett's (my-writing-style), from his
// own answers on 2026-11-20. No affiliations named (decision 0038).

const PATH = '/firstpass-vs-pdf-practice-plans';
const TITLE = 'Firstpass vs. a PDF practice plan and a clipboard';
const DESCRIPTION =
  'A downloaded PDF gives you one practice someone else planned. Firstpass plans practices for your ice time and your skill groups, learns from each one, and you can still print it for the glass.';
const PUBLISHED = '2026-11-20';

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
    type: 'article',
    locale: 'en_CA',
    images: [{ url: `${SITE}/og/firstpass-landing.png`, width: 1200, height: 630, alt: 'Firstpass: practice plans for U5–U9 hockey.' }],
  },
  twitter: { card: 'summary_large_image', images: [`${SITE}/og/firstpass-landing.png`] },
};

const data = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: TITLE,
      description: DESCRIPTION,
      url: `${SITE}${PATH}`,
      mainEntityOfPage: `${SITE}${PATH}`,
      datePublished: PUBLISHED,
      dateModified: PUBLISHED,
      inLanguage: 'en-CA',
      author: {
        '@type': 'Person',
        name: 'Brett',
        jobTitle: 'U7 hockey coach and founder of Firstpass',
        address: { '@type': 'PostalAddress', addressLocality: 'Nanaimo', addressRegion: 'BC', addressCountry: 'CA' },
      },
      publisher: { '@id': `${SITE}/#organization` },
      about: 'Planning youth hockey practices: a downloaded practice plan compared with Firstpass',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Firstpass', item: SITE },
        { '@type': 'ListItem', position: 2, name: TITLE, item: `${SITE}${PATH}` },
      ],
    },
  ],
};

const ROWS: [string, string, string][] = [
  ['Finding a plan', 'Search, download, and pick from too many', 'Your first practice is planned when you set up your team'],
  ['Your ice time', 'Written for someone else’s practice', 'Timed to your ice, minute by minute'],
  ['Skill groups', 'One version for everyone', 'Skill groups built in, and many drills have an easier and a harder version'],
  ['Stations', 'You work out the rotation yourself', 'Station rotations planned and timed for half ice'],
  ['Next week', 'Start over, or run the same one again', 'Starts from your last practice, with suggestions from your 20-second check-in'],
  ['Co-coaches', 'Drills in the group chat, forgotten by puck drop', 'Every coach has the plan and the next drill on their phone'],
  ['Parents', 'Nothing', 'One link to the plan. No app, no sign-in.'],
  ['On the glass', 'Print it and tape it up', 'Print it and tape it up'],
  ['Cost', 'Free', 'Free for every team this season'],
];

export default function ComparePdfPage() {
  return (
    <ContentFrame data={data}>
      <p className="text-[15px] font-medium text-rink-100">Compare</p>
      <h1 className="mt-2 font-display text-[clamp(32px,5vw,46px)] font-extrabold leading-[1.06] tracking-[-0.03em]">{TITLE}</h1>
      <p className="mt-5 text-[19px] leading-[1.6]">
        A downloaded PDF gives you one practice that someone else planned. Firstpass plans practices for your ice time and your skill groups, then suggests changes for next week from how this one went. You can still print it for the glass.
      </p>

      <h2 className={prose.h2}>What I used before</h2>
      <p className={prose.p}>
        You can download practice plans, and there are a lot of them. They were never right for our team, and there were too many to choose from. It was overwhelming.
      </p>
      <p className={prose.p}>
        None of them knew our skill groups. And they couldn’t change from one practice to the next as we learned what worked and what didn’t.
      </p>
      <p className={prose.p}>
        Other coaches would share a few drills in our group chat before practice. By the time we were on the ice, most of us had forgotten what they were and what the overall plan was. We needed something concrete in the moment.
      </p>

      <h2 className={prose.h2}>Side by side</h2>
      <ul className="mt-6 flex flex-col gap-3 sm:hidden">
        {ROWS.map(([what, pdf, fp]) => (
          <li key={what} className="rounded-2xl border border-border-100 p-4">
            <h3 className="font-display text-[18px] font-bold leading-tight">{what}</h3>
            <dl className="mt-2 flex flex-col gap-1.5 text-[16px] leading-[1.5]">
              <div>
                <dt className="text-[13px] font-medium text-ink-200">A PDF and a clipboard</dt>
                <dd className="text-ink-200">{pdf}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-rink-100">Firstpass</dt>
                <dd>{fp}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border-100 sm:block">
        <table className="w-full min-w-[560px] border-collapse text-left text-[16px] leading-[1.5]">
          <thead className="bg-surface-200">
            <tr>
              <th scope="col" className="w-[28%] px-4 py-3 font-semibold">
                <span className="sr-only">What you need</span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                A PDF and a clipboard
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-rink-100">
                Firstpass
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([what, pdf, fp]) => (
              <tr key={what} className="border-t border-border-100 align-top">
                <th scope="row" className="px-4 py-3 font-semibold">
                  {what}
                </th>
                <td className="px-4 py-3 text-ink-200">{pdf}</td>
                <td className="px-4 py-3">{fp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={prose.h2}>What paper still does better</h2>
      <p className={prose.p}>
        A sheet on the wall or the glass that every coach can glance at. It makes running the practice and staying on schedule much easier, and it doesn’t need a phone or a charged battery in a cold rink.
      </p>
      <p className={prose.p}>
        So keep the paper. Print your Firstpass plan and tape it up. The difference is what’s on the sheet: a plan for your team, this week, with your skill groups and your coaches.
      </p>

      <h2 className={prose.h2}>Why I built Firstpass</h2>
      <p className={prose.p}>
        I was a coach on the ice not sure what was going on, what the next drill was, or how I could help. I wanted to feel more empowered, and I wanted the other assistant coaches to feel the same.
      </p>

      <h2 className={prose.h2}>When a PDF is enough</h2>
      <ul className={prose.ul}>
        <li>You’re helping out for one practice, and the head coach has the plan.</li>
        <li>Your association already gives you plans that fit your ice time and your groups.</li>
      </ul>
      <p className={prose.p}>
        If you’re running a team all season, with kids at different levels and a few parent volunteers on the ice, that’s what Firstpass is for. For a real example, see{' '}
        <Link href="/u7/stations-half-ice" className="inline-flex min-h-11 items-center text-rink-100 underline underline-offset-2">
          How do I run stations on half ice?
        </Link>
      </p>

      <section aria-labelledby="cta-title" className="band-teal mt-12 rounded-2xl p-[clamp(20px,4vw,32px)] text-white">
        <h2 id="cta-title" className="font-display text-[clamp(24px,3vw,30px)] font-bold leading-tight">
          A plan for your team, not someone else’s
        </h2>
        <p className="mt-3 text-[17px] leading-[1.6] text-white/85">Set up your ice time and skill groups once. Your first practice is planned for you, and each one after starts from the last, with suggestions from how it went. On your phone and ready to print. Free for every team this season.</p>
        <StartLink className={`${ctaOnTeal} mt-5`} />
      </section>

      <p className="mt-10 border-t border-border-100 pt-5 text-[15px] leading-[1.5] text-ink-200">
        Written by Brett, a U7 coach in Nanaimo, BC. November 20, 2026.{' '}
        <Link href="/u7" className="inline-flex min-h-11 items-center text-rink-100 underline underline-offset-2">
          More U7 practice help
        </Link>
      </p>
    </ContentFrame>
  );
}
