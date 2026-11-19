import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, SITE } from '@/lib/site/public-pages';

// sitemap.xml (decision 0037): only public pages that belong in search, from one list.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((p) => ({
    url: p.path === '/' ? SITE : `${SITE}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
