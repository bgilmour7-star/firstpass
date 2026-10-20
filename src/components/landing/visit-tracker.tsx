'use client';

import { useEffect } from 'react';
import { track } from '@/app/site-actions';

// Counts the visit, and whether the visitor scrolled to the waitlist form (decision 0019). No
// cookies: where the visitor came from is kept in sessionStorage for this tab only, so a later
// event (and the sign-up) carries the same source.
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

export function VisitTracker() {
  useEffect(() => {
    const source = visitSource();
    void track('view', location.pathname, source);
    const form = document.getElementById('join');
    if (!form || !('IntersectionObserver' in window)) return;
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void track('reached_form', location.pathname, source);
          seen.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    seen.observe(form);
    return () => seen.disconnect();
  }, []);
  return null;
}
