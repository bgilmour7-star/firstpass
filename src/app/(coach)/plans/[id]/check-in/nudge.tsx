'use client';

import Link from 'next/link';
import { useState } from 'react';

// Opening the next plan asks about the last practice first, if you skipped its check-in.
// It never blocks planning: Skip hides it.
export function CheckinNudge({ practiceId, day }: { practiceId: string; day: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border-100 bg-surface-200 px-4 py-3">
      <p className="text-[15px]">
        <b>First, how did {day} go?</b> <span className="text-ink-200">About 20 seconds. It shapes this plan.</span>
      </p>
      <span className="ml-auto flex gap-1.5">
        <button type="button" onClick={() => setHidden(true)} className="min-h-11 rounded-full px-4 text-sm text-ink-200 hover:bg-surface-300">
          Skip
        </button>
        <Link href={`/plans/${practiceId}/check-in`} className="grid min-h-11 place-items-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200">
          Check in
        </Link>
      </span>
    </div>
  );
}
