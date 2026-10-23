'use client';

import { useReportWebVitals } from 'next/web-vitals';

// Page speed from real visits (decision 0025): Core Web Vitals, batched per page and sent once
// the page is hidden, with sendBeacon so it survives the tab closing. Production only.

const KEEP = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);
let queue: Record<string, { name: string; value: number }[]> = {};
let listening = false;

function flush() {
  const batches = queue;
  queue = {};
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
    const path = location.pathname;
    (queue[path] ??= []).push({ name: m.name, value: Math.round(m.value * (m.name === 'CLS' ? 1000 : 1)) / (m.name === 'CLS' ? 1000 : 1) });
    if (!listening) {
      listening = true;
      addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
      addEventListener('pagehide', flush);
    }
  });
  return null;
}
