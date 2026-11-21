'use client';

import Link from 'next/link';
import { useState } from 'react';
import { nameMatches } from '@/lib/plans/drawer';

export type ReviewItem = { id: string; funName: string; plainName: string; card: React.ReactNode };

/**
 * The review list with the same name search as the coaches' Drills page. Filters as you type,
 * inside whichever status tab is on; when the tab hides every match, it offers the search across
 * all drills.
 */
export function ReviewSearch({ items, tab, initialQ, tabs, empty }: { items: ReviewItem[]; tab: string | null; initialQ: string; tabs: React.ReactNode; empty: React.ReactNode }) {
  const [q, setQ] = useState(initialQ);
  const shown = items.filter((d) => nameMatches(d, q));
  return (
    <>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          aria-label="Search drills"
          placeholder="Search drills"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6 sm:max-w-sm"
        />
        {tabs}
      </div>
      {items.length === 0 ? (
        empty
      ) : q.trim() && shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-100 p-8 text-center text-sm text-ink-200">
          No drill called “{q.trim()}”{tab ? ` in ${tab}` : ''}.
          {tab && (
            <>
              {' '}
              <Link href={`/admin/drills?q=${encodeURIComponent(q.trim())}`} className="font-semibold text-ink-100 underline underline-offset-2">
                Search all drills
              </Link>
            </>
          )}
        </p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((d) => (
            <li key={d.id}>{d.card}</li>
          ))}
        </ul>
      )}
    </>
  );
}
