import Link from 'next/link';
import { ContentFrame, cta } from '@/components/content/content-frame';
import { StartLink } from '@/components/landing/start-link';
import { hubFor, pagesFor } from '@/lib/content/pages';
import { hubMetadata, hubStructuredData } from '@/lib/content/meta';

// The U7 hub (decision 0038): every U7 answer page, newest first. Pages are listed in
// src/lib/content/pages.ts.

const hub = hubFor('U7')!;
const pages = [...pagesFor('U7')].sort((a, b) => b.published.localeCompare(a.published));

export const metadata = hubMetadata(hub);

export default function U7Hub() {
  return (
    <ContentFrame data={hubStructuredData(hub, pages)}>
      <h1 className="font-display text-[clamp(36px,5.5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.03em]">{hub.title}</h1>
      <p className="mt-5 text-[19px] leading-[1.6]">{hub.intro}</p>

      <ul className="mt-10 flex flex-col gap-3">
        {pages.map((p) => (
          <li key={p.path}>
            <Link href={p.path} className="block rounded-2xl border border-border-100 p-5 hover:border-rink-100 hover:bg-surface-200">
              <span className="font-display text-[22px] font-bold leading-tight">{p.question}</span>
              <span className="mt-2 block text-[16px] leading-[1.55] text-ink-200">{p.summary}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="cta-title" className="mt-12 rounded-2xl bg-surface-200 p-[clamp(20px,4vw,32px)]">
        <h2 id="cta-title" className="font-display text-[clamp(22px,3vw,28px)] font-bold leading-tight">Every practice, planned for your team</h2>
        <p className="mt-3 text-[17px] leading-[1.6]">Firstpass builds each practice for your ice time and skill groups. Free for every team this season.</p>
        <StartLink className={`${cta} mt-5`} />
      </section>
    </ContentFrame>
  );
}
