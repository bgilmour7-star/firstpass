'use client';

import { useEffect, useRef } from 'react';

/**
 * A drawer from the right on a computer and a bottom sheet under 1024px: the Team page's section
 * editors (T3-Edit) and, wide (680px), the Admin → Emails preview. Escape, the backdrop or Close
 * shut it; Tab stays inside it. When `page` changes (Previous/Next) the body scrolls back to the top.
 */
export function Drawer({ title, kicker, onClose, footer, children, wide = false, page }: { title: string; kicker?: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode; wide?: boolean; page?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [page]);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Keep Tab inside the drawer (aria-modal): wrap from the last control to the first and back.
      const all = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, iframe, [tabindex]:not([tabindex="-1"])')];
      const first = all[0];
      const last = all[all.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
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
      <section ref={panelRef} className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-100 shadow-xl lg:h-full lg:max-h-none ${wide ? 'lg:max-w-[680px]' : 'lg:max-w-[480px]'} lg:rounded-none`}>
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
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-4 border-t border-border-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </section>
    </div>
  );
}
