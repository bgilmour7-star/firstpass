import Link from 'next/link';

/** Latest report / Over the season (decision 0030, part D). Links, so each view has its own address. */
export function ProgressTabs({ active }: { active: 'report' | 'season' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined} className={`grid min-h-11 place-items-center rounded-full px-4 text-sm ${on ? 'bg-rink-200 text-surface-100' : 'border border-border-100 hover:bg-surface-300'}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Progress views" className="flex gap-1.5">
      {tab('/progress', 'Latest report', active === 'report')}
      {tab('/progress/season', 'Over the season', active === 'season')}
    </nav>
  );
}
