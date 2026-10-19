'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useRef } from 'react';
import { BLOCK_FOR, PART_LABEL, shapeLabel, type Drill } from '@/lib/drills/schema';
import type { Favorite } from '@/lib/app/store';
import { DrillDetail } from '@/components/drill-detail';
import { FavoriteButton } from '@/components/favorite-button';

// Opening a drill from a plan keeps you on the plan (decision 0015): the drill slides in from the
// right, Escape or the backdrop closes it, and "Open full page" still links out, with a way back.
export const OpenDrill = createContext<(id: string) => void>(() => {});
export const useOpenDrill = () => useContext(OpenDrill);

export function DrillDrawer({
  drill: d,
  planId,
  favorite,
  onFavorite,
  onClose,
}: {
  drill: Drill;
  planId: string;
  favorite: Favorite | null;
  onFavorite: (f: Favorite | null) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
      back?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={d.funName}>
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[560px] flex-col bg-surface-100 shadow-xl">
        <header className="flex items-start gap-3 border-b border-border-100 px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[24px] font-extrabold leading-7 text-balance">{d.funName}</h2>
            <p className="mt-1 text-[13px] leading-5 text-ink-200">
              {PART_LABEL[d.part]} · {shapeLabel(d)}, goes in a {BLOCK_FOR[d.groupModel]} block · {d.plainName} · <span className="font-mono">{d.minutes} min</span> · {d.gear}
            </p>
          </div>
          <FavoriteButton key={d.id} drillId={d.id} drillName={d.funName} initial={favorite} onChange={onFavorite} />
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-surface-200 hover:text-ink-100"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <DrillDetail drill={d} wide={false} />
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border-100 px-5 py-3">
          <Link href={`/drills/${d.id}?from=${encodeURIComponent(`/plans/${planId}`)}`} className="text-sm font-medium text-rink-100 hover:underline">
            Open full page
          </Link>
          <button type="button" onClick={onClose} className="min-h-10 rounded-full bg-ink-100 px-5 text-sm font-semibold text-surface-100 hover:opacity-90">
            Back to the plan
          </button>
        </footer>
      </div>
    </div>
  );
}
