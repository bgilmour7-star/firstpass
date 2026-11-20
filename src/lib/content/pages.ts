// The answer pages (decision 0038; "Firstpass SEO and AEO plan"): one coach question per page,
// answered with a real Firstpass plan. Hubs (/u7) list their pages from here, and the sitemap and
// the middleware read PUBLIC_PAGES, which includes every page listed here.

export type AgeGroup = 'U5' | 'U7' | 'U9';

export type AnswerPage = {
  path: string;
  age: AgeGroup;
  /** The question, as a coach would type it. The page's H1 and title. */
  question: string;
  /** One or two sentences for the hub and the meta description. */
  summary: string;
  /** YYYY-MM-DD, America/Vancouver. */
  published: string;
  /** Last checked against real practices. */
  updated: string;
};

export const ANSWER_PAGES: AnswerPage[] = [
  {
    path: '/u7/first-practice',
    age: 'U7',
    question: 'How do I run my first U7 hockey practice?',
    summary: 'A simple 60-minute half-ice plan for 10 to 14 kids and 3 coaches, and what we learned running our first one.',
    published: '2026-11-19',
    updated: '2026-11-19',
  },
  {
    path: '/u7/keep-kids-listening',
    age: 'U7',
    question: 'How do I keep 6-year-olds listening on the ice?',
    summary: 'Short explanations, a signal they know, and as few new drills as possible. What works with our U7 team in Nanaimo.',
    published: '2026-11-19',
    updated: '2026-11-19',
  },
];

export type Hub = { path: string; age: AgeGroup; title: string; intro: string; updated: string };

export const HUBS: Hub[] = [
  {
    path: '/u7',
    age: 'U7',
    title: 'U7 hockey practice help for volunteer coaches',
    intro: 'Plain answers for parents coaching 5 and 6 year olds, with real practice plans from our own team in Nanaimo, BC.',
    updated: '2026-11-19',
  },
];

export const pagesFor = (age: AgeGroup) => ANSWER_PAGES.filter((p) => p.age === age);
export const hubFor = (age: AgeGroup) => HUBS.find((h) => h.age === age);
