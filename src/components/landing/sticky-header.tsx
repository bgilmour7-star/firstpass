'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mark } from './mark';

// The landing page header. It stays at the top as you scroll; once the hero's "Get early access"
// button has scrolled away, the header turns half see-through and carries the button itself, so
// there's always a way to join. While the form is on screen the header's button steps aside, so
// there's never two at once. On a phone, Sign in makes room for the button while it shows.
export function StickyHeader() {
  const [stuck, setStuck] = useState(false);
  const [formInView, setFormInView] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero-cta');
    const form = document.getElementById('join');
    if (!('IntersectionObserver' in window)) return;
    const watchers: IntersectionObserver[] = [];
    if (hero) {
      // "Stuck" once the hero button is above the top of the screen (not when it's below, on load).
      const w = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0));
      w.observe(hero);
      watchers.push(w);
    }
    if (form) {
      const w = new IntersectionObserver(([e]) => setFormInView(e.isIntersecting), { threshold: 0.2 });
      w.observe(form);
      watchers.push(w);
    }
    return () => watchers.forEach((w) => w.disconnect());
  }, []);

  const showCta = stuck && !formInView;

  return (
    <div className={`sticky top-0 z-40 transition-[background-color,box-shadow] duration-200 ${stuck ? 'bg-surface-100/50 shadow-[0_1px_0_var(--border-100)] backdrop-blur-md' : 'bg-transparent'}`}>
      <header className={`mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 transition-[padding] duration-200 sm:px-[clamp(16px,4vw,48px)] ${stuck ? 'py-2.5' : 'py-5'}`}>
        <Link href="/" aria-label="Firstpass home" className="inline-flex items-center gap-2.5">
          <Mark className="size-[30px]" />
          <span className="font-display text-2xl font-extrabold leading-none tracking-[-0.01em]">Firstpass</span>
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1">
          <Link href="/login" className={`min-h-11 items-center px-3.5 text-[15px] font-medium hover:underline ${showCta ? 'hidden sm:inline-flex' : 'inline-flex'}`}>
            Sign in
          </Link>
          <a
            href="#join"
            aria-hidden={!showCta}
            tabIndex={showCta ? undefined : -1}
            className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-rink-100 px-5 text-[15px] font-medium text-surface-100 transition-[opacity,transform] duration-200 hover:bg-rink-200 ${showCta ? 'translate-y-0 opacity-100' : 'pointer-events-none absolute -translate-y-1 opacity-0'}`}
          >
            Get early access
          </a>
        </nav>
      </header>
    </div>
  );
}
