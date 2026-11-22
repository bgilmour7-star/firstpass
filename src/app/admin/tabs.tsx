'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Admin pages each have their own item in the left nav, under the Admin heading (decision 0050).
// Two of them pair with a sibling page, shown as tabs at the top: Leads with Survey (the waitlist
// survey's answers), and Emails with Send. The other pages have no tabs.
const GROUPS = [
  [
    { href: '/admin/leads', label: 'Leads' },
    { href: '/admin/survey', label: 'Survey' },
  ],
  [
    { href: '/admin/emails', label: 'All emails' },
    { href: '/admin/send', label: 'Send' },
  ],
];

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function AdminTabs() {
  const path = usePathname();
  const tabs = GROUPS.find((g) => g.some((t) => under(path, t.href)));
  if (!tabs) return null;
  return (
    <nav aria-label="This section" className="-mt-1 mb-6 flex gap-5 overflow-x-auto border-b border-border-100 text-sm">
      {tabs.map((t) => {
        const on = under(path, t.href);
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
