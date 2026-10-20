'use client';

import Link from 'next/link';
import { useState } from 'react';
import { nameMatches } from '@/lib/plans/drawer';
import { RequestDrill } from '@/components/drill-request';

export type LibraryItem = { id: string; funName: string; plainName: string; card: React.ReactNode };

/**
 * The drill grid with the drawer's name search above it. Filters as you type, inside whichever
 * chip is on; when the chip hides every match, it offers the same search across all drills.
 */
export function LibrarySearch({ items, scope, initialQ, filters }: { items: LibraryItem[]; scope: string | null; initialQ: string; filters: React.ReactNode }) {
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
        {filters}
      </div>
      {q.trim() && shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-100 p-8 text-center text-sm text-ink-200">
          No drill called “{q.trim()}”{scope ? ` in ${scope}` : ''}.
          {scope && (
            <>
              {' '}
              <Link href={`/drills?q=${encodeURIComponent(q.trim())}`} className="font-semibold text-ink-100 underline underline-offset-2">
                Search all drills
              </Link>
            </>
          )}
          {!scope && (
            <>
              {' '}
              <RequestDrill variant="link" prefill={`A drill called “${q.trim()}”. `} />
            </>
          )}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <li key={d.id} className="relative">
              {d.card}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
