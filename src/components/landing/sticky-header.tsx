'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mark } from './mark';

// The landing page header. At the top it's an ordinary header that scrolls away with the page.
// Once the hero's "Get early access" button has scrolled out of view, a solid bar slides in at the
// top with the logo and the button, so there's always a way to join. While the form is on screen
// the bar's button steps aside, so there's never two at once. On a phone, Sign in makes room for
// the button while it shows.

function Logo() {
  return (
    <Link href="/" aria-label="Firstpass home" className="inline-flex items-center gap-2.5">
      <Mark className="size-[30px]" />
      <span className="font-display text-2xl font-extrabold leading-none tracking-[-0.01em]">Firstpass</span>
    </Link>
  );
}

const signIn = 'min-h-11 items-center px-3.5 text-[15px] font-medium hover:underline';
const row = 'mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-[clamp(16px,4vw,48px)]';

export function StickyHeader() {
  const [past, setPast] = useState(false);
  const [formInView, setFormInView] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero-cta');
    const form = document.getElementById('join');
    if (!('IntersectionObserver' in window)) return;
    const watchers: IntersectionObserver[] = [];
    if (hero) {
      // Past it once the hero button is above the top of the screen (not when it's below, on load).
      const w = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0));
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

  const showCta = past && !formInView;

  return (
    <>
      <header className={`${row} py-5`}>
        <Logo />
        <nav aria-label="Account">
          <Link href="/login" className={`inline-flex ${signIn}`}>
            Sign in
          </Link>
        </nav>
      </header>

      {/* The bar that follows you down the page. Out of sight, and out of the tab order, until then. */}
      <div
        aria-hidden={!past}
        inert={!past}
        className={`fixed inset-x-0 top-0 z-40 border-b border-border-100 bg-surface-100 transition-transform duration-200 ${past ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className={`${row} py-2.5`}>
          <Logo />
          <nav aria-label="Account" className="flex items-center gap-1">
            <Link href="/login" className={`${signIn} ${showCta ? 'hidden sm:inline-flex' : 'inline-flex'}`}>
              Sign in
            </Link>
            <a
              href="#join"
              aria-hidden={!showCta}
              tabIndex={showCta ? undefined : -1}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-rink-100 px-5 text-[15px] font-medium text-surface-100 transition-opacity duration-200 hover:bg-rink-200 ${showCta ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}`}
            >
              Get early access
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}
