'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Brett's pages under Admin (decisions 0019, 0027): Analytics, Waitlist, Survey, Coaches, Emails.
// Shown only on those pages; drill review keeps its own screen.
const TABS = [
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/survey', label: 'Survey' },
  { href: '/admin/coaches', label: 'Coaches' },
  { href: '/admin/emails', label: 'Emails' },
];

export function AdminTabs() {
  const path = usePathname();
  if (!TABS.some((t) => path === t.href || path.startsWith(`${t.href}/`))) return null;
  return (
    <nav aria-label="Brett’s pages" className="-mt-1 mb-6 flex gap-5 overflow-x-auto border-b border-border-100 text-sm">
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 ${on ? 'border-ink-100 font-semibold text-ink-100' : 'border-transparent text-ink-200 hover:text-ink-100'}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
