import { SITE } from './public-pages';

// Structured data for the landing page (decision 0037): who makes Firstpass, the site, and the app,
// so search engines and AI assistants can describe it correctly. No FAQ (the page has no visible FAQ)
// and no ratings (there are none). Keep the description in step with the landing page's.

export const LANDING_DESCRIPTION =
  'Set up your team once and every practice arrives planned: timed to your ice, split for your skill groups, and ready on your phone at the rink.';

export function landingStructuredData() {
  const org = `${SITE}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: 'Firstpass',
        url: SITE,
        logo: `${SITE}/icons/icon-512.png`,
        email: 'hello@firstpass.coach',
        address: { '@type': 'PostalAddress', addressLocality: 'Nanaimo', addressRegion: 'BC', addressCountry: 'CA' },
      },
      { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Firstpass', url: SITE, inLanguage: 'en-CA', publisher: { '@id': org } },
      {
        '@type': 'WebApplication',
        '@id': `${SITE}/#app`,
        name: 'Firstpass',
        url: SITE,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web, iOS, Android',
        description: LANDING_DESCRIPTION,
        audience: { '@type': 'Audience', audienceType: 'Volunteer U5–U9 hockey coaches' },
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'CAD', description: 'Free for every team in the 2026–27 season', priceValidUntil: '2027-08-31' },
        publisher: { '@id': org },
      },
    ],
  };
}

/** For a <script type="application/ld+json">: `<` escaped so the JSON can't close the script tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
