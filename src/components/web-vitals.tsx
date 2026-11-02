'use client';

import { useReportWebVitals } from 'next/web-vitals';

// Page speed from real visits (decision 0029): Core Web Vitals, batched per page and sent once
// the page is hidden, with sendBeacon so it survives the tab closing. Production only.
// Like visit counts (visit-tracker.tsx), only for a person: nothing is sent until there's been a
// trusted tap, key, wheel or pointer move, and never from a browser that reports automation, so the
// monitoring services that load the site from data centres don't skew the numbers.

const KEEP = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);
let queue: Record<string, { name: string; value: number }[]> = {};
let listening = false;
let person = false;
// Speed is measured once per full page load, but CLS and INP arrive when the tab is hidden, maybe after
// moving to another page in the app: file them all under the page that was loaded.
let loadPath: string | null = null;
const HUMAN = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
function sawPerson(e: Event) {
  if (!e.isTrusted) return;
  person = true;
  HUMAN.forEach((t) => removeEventListener(t, sawPerson));
}

function flush() {
  const batches = queue;
  queue = {};
  if (!person || navigator.webdriver) return;
  for (const [path, metrics] of Object.entries(batches)) {
    const body = JSON.stringify({ path, metrics: metrics.slice(0, 10) });
    try {
      if (!navigator.sendBeacon?.('/api/vitals', new Blob([body], { type: 'application/json' }))) {
        void fetch('/api/vitals', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
      }
    } catch {
      // Speed numbers are a nice-to-have; never bother the coach.
    }
  }
}

export function WebVitals() {
  useReportWebVitals((m) => {
    if (process.env.NODE_ENV !== 'production' || !KEEP.has(m.name)) return;
    const path = (loadPath ??= location.pathname);
    (queue[path] ??= []).push({ name: m.name, value: Math.round(m.value * (m.name === 'CLS' ? 1000 : 1)) / (m.name === 'CLS' ? 1000 : 1) });
    if (!listening) {
      listening = true;
      HUMAN.forEach((t) => addEventListener(t, sawPerson, { passive: true }));
      addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
      addEventListener('pagehide', flush);
    }
  });
  return null;
}
