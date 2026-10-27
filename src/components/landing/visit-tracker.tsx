'use client';

import { useEffect } from 'react';
import { track } from '@/app/site-actions';

// Counts the visit once there's a sign of a person (a scroll, tap, key or mouse move), and whether
// they scrolled to the waitlist form (decision 0019). No cookies: where the visitor came from is
// kept in sessionStorage for this tab only, so a later event (and the sign-up) carries the same source.
const KEY = 'fp_src';

export function visitSource(): string | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved !== null) return saved || null;
    const q = new URLSearchParams(location.search);
    let src = q.get('from') || q.get('utm_source') || '';
    if (!src && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host !== location.hostname) src = host;
    }
    sessionStorage.setItem(KEY, src);
    return src || null;
  } catch {
    return null;
  }
}

/** Signs of a person, not a robot loading the page: monitoring and scanning services open it in a
 *  real browser (often a phone and a desktop size a few seconds apart) and never touch it. Input
 *  events only: a script can scroll the page (and some robots do), but it can't make a trusted tap,
 *  key or wheel. People who scroll get here through touchstart or wheel. */
const HUMAN = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;

export function VisitTracker() {
  useEffect(() => {
    // Browsers driven by automation say so.
    if (navigator.webdriver) return;
    const source = visitSource();
    let counted = false;
    let seen: IntersectionObserver | undefined;
    const stopListening = () => HUMAN.forEach((e) => window.removeEventListener(e, count));
    function count(e: Event) {
      if (counted || !e.isTrusted) return;
      counted = true;
      stopListening();
      void track('view', location.pathname, source);
      // Reaching the form only counts for a counted visit.
      const form = document.getElementById('join');
      if (!form || !('IntersectionObserver' in window)) return;
      seen = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            void track('reached_form', location.pathname, source);
            seen?.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      seen.observe(form);
    }
    HUMAN.forEach((e) => window.addEventListener(e, count, { passive: true }));
    return () => {
      stopListening();
      seen?.disconnect();
    };
  }, []);
  return null;
}
