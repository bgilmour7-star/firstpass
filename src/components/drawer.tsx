'use client';

import { useEffect, useRef } from 'react';

/**
 * One section of the team, edited on its own (T3-Edit): a drawer from the right (wide: 680px, for an email preview) on a computer and a
 * bottom sheet under 1024px. Escape, the backdrop or Close shut it.
 */
export function Drawer({ title, kicker, onClose, footer, children, wide = false }: { title: string; kicker?: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-end lg:items-stretch" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <section className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-100 shadow-xl lg:h-full lg:max-h-none ${wide ? 'lg:max-w-[680px]' : 'lg:max-w-[480px]'} lg:rounded-none`}>
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-100 lg:hidden" />
        <header className="flex items-center justify-between gap-3 border-b border-border-100 px-6 pb-4 pt-3 lg:pt-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            {kicker && <span className="truncate text-[13px] text-ink-200">{kicker}</span>}
            <h2 id="drawer-title" className="font-display text-2xl font-bold leading-[30px]">
              {title}
            </h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-200">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-4 border-t border-border-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </section>
    </div>
  );
}
