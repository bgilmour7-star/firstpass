'use client';

import { useState } from 'react';
import { Rink } from '@/components/ds';
import { levelCount, levelOf, type Drill } from '@/lib/drills/schema';

// A drill's levels as a switcher, like picking a colour on a product: one rink that swaps with the
// level, instead of every level's diagram side by side (decision 0049).
export function LevelSwitcher({ drill: d }: { drill: Drill }) {
  const count = levelCount(d);
  const [n, setN] = useState(1);
  const l = levelOf(d, n);
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Level" className="grid gap-1.5 rounded-xl bg-surface-200 p-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => i + 1).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === n}
            onClick={() => setN(k)}
            className={`min-h-11 rounded-lg text-sm ${k === n ? 'bg-rink-100 font-semibold text-surface-100' : 'text-ink-100 hover:bg-surface-300'}`}
          >
            Level {k}
          </button>
        ))}
      </div>
      <Rink spec={l.diagram} title={`${d.funName} level ${l.n}`} className="rounded-sm border border-border-100" />
      <div className="flex flex-col gap-1" aria-live="polite">
        <b className="text-sm">{l.name}</b>
        <span className="text-sm text-ink-200">{l.n === 1 ? 'The drill as written.' : `Adds: ${l.adds}`}</span>
      </div>
    </div>
  );
}
