import type { Metadata } from 'next';
import { SITE } from '@/lib/site/public-pages';
import type { AnswerPage, Hub } from './pages';

// Metadata and structured data for the answer pages and hubs (decision 0038). Every one is in
// search (the root layout defaults to noindex), with a canonical URL and a share card.

const OG_IMAGE = { url: `${SITE}/og/firstpass-landing.png`, width: 1200, height: 630, alt: 'Firstpass: practice plans for U5–U9 hockey, with a three-zone rotation on half ice.' };

function base(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE}${path}` },
    openGraph: { title, description, url: `${SITE}${path}`, siteName: 'Firstpass', type: 'article', locale: 'en_CA', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', images: [OG_IMAGE.url] },
  };
}

export const answerMetadata = (p: AnswerPage): Metadata => base(p.path, `${p.question} · Firstpass`, p.summary);
export const hubMetadata = (h: Hub): Metadata => base(h.path, `${h.title} · Firstpass`, h.intro);

const AUTHOR = { '@type': 'Person', name: 'Brett', jobTitle: 'U7 hockey coach and founder of Firstpass', address: { '@type': 'PostalAddress', addressLocality: 'Nanaimo', addressRegion: 'BC', addressCountry: 'CA' } };
const PUBLISHER = { '@id': `${SITE}/#organization` };

function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE}${it.path === '/' ? '' : it.path}` })),
  };
}

export function answerStructuredData(p: AnswerPage, hub: Hub | undefined) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: p.question,
        description: p.summary,
        url: `${SITE}${p.path}`,
        mainEntityOfPage: `${SITE}${p.path}`,
        datePublished: p.published,
        dateModified: p.updated,
        inLanguage: 'en-CA',
        author: AUTHOR,
        publisher: PUBLISHER,
        about: `${p.age} youth hockey practice planning`,
      },
      breadcrumbs([{ name: 'Firstpass', path: '/' }, ...(hub ? [{ name: `${hub.age} practice help`, path: hub.path }] : []), { name: p.question, path: p.path }]),
    ],
  };
}

export function hubStructuredData(h: Hub, pages: AnswerPage[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: h.title,
        description: h.intro,
        url: `${SITE}${h.path}`,
        inLanguage: 'en-CA',
        publisher: PUBLISHER,
        hasPart: pages.map((p) => ({ '@type': 'Article', headline: p.question, url: `${SITE}${p.path}` })),
      },
      breadcrumbs([{ name: 'Firstpass', path: '/' }, { name: `${h.age} practice help`, path: h.path }]),
    ],
  };
}
