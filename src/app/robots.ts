import type { MetadataRoute } from 'next';
import { AI_BOTS, SITE } from '@/lib/site/public-pages';

// robots.txt (decision 0037). Search engines and AI answer crawlers are welcome on public pages.
// /p/, /s/ and /join/ aren't blocked: they carry noindex, and a crawler must fetch a page to see it.
export default function robots(): MetadataRoute.Robots {
  const rule = { allow: '/', disallow: ['/api/', '/admin'] };
  return {
    rules: [
      { userAgent: '*', ...rule },
      { userAgent: AI_BOTS, ...rule },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
