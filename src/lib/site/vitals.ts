import { z } from 'zod';
import type { Device } from './schema';

// Page speed (decision 0025): Core Web Vitals from real visits, sent by the browser after a page
// loads. Only the metric, its value, which kind of page and the kind of device are kept: no
// visitor id, no user, no address. Thresholds are Google's "good" and "poor" lines.

export const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
export type MetricName = (typeof METRICS)[number];

export const METRIC_INFO: Record<MetricName, { label: string; what: string; good: number; poor: number; unit: 'ms' | '' }> = {
  LCP: { label: 'Page shows', what: 'Time until the main content is on screen', good: 2500, poor: 4000, unit: 'ms' },
  INP: { label: 'Taps respond', what: 'How long a tap takes to show a response', good: 200, poor: 500, unit: 'ms' },
  CLS: { label: 'Stays still', what: 'How much the page jumps around while loading', good: 0.1, poor: 0.25, unit: '' },
  FCP: { label: 'First paint', what: 'Time until anything is on screen', good: 1800, poor: 3000, unit: 'ms' },
  TTFB: { label: 'Server reply', what: 'Time until the server starts answering', good: 800, poor: 1800, unit: 'ms' },
};

export const PAGES = ['Landing', 'Today', 'Plans', 'Planner', 'Check-in', 'Drills', 'Team', 'Parent link', 'Admin', 'Other'] as const;
export type PageGroup = (typeof PAGES)[number];

/** Which kind of page a path is, so plans and drills group together without their ids. */
export function pageGroup(path: string): PageGroup {
  const p = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (p === '/') return 'Landing';
  if (p === '/today') return 'Today';
  if (p === '/plans') return 'Plans';
  if (/^\/plans\/[^/]+\/check-in$/.test(p)) return 'Check-in';
  if (/^\/plans\/[^/]+$/.test(p)) return 'Planner';
  if (p.startsWith('/drills')) return 'Drills';
  if (p.startsWith('/team')) return 'Team';
  if (p.startsWith('/p/')) return 'Parent link';
  if (p.startsWith('/admin')) return 'Admin';
  return 'Other';
}

/** What the browser posts to /api/vitals: a few metrics from one page view. */
export const vitalsInput = z.object({
  path: z.string().max(300),
  metrics: z
    .array(z.object({ name: z.enum(METRICS), value: z.number().finite().min(0).max(120_000) }))
    .min(1)
    .max(10),
});

export type Vital = { occurredAt: string; metric: MetricName; value: number; page: PageGroup; device: Device | null };
export type Rating = 'good' | 'needs-work' | 'poor';

export function rate(metric: MetricName, value: number): Rating {
  const m = METRIC_INFO[metric];
  return value <= m.good ? 'good' : value <= m.poor ? 'needs-work' : 'poor';
}

/** The 75th percentile, the number Google uses: three visits in four were at least this fast. */
export function p75(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.75 * s.length) - 1)];
}

export function formatVital(metric: MetricName, value: number | null): string {
  if (value == null) return '–';
  if (METRIC_INFO[metric].unit === '') return value.toFixed(2);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

export type SpeedSummary = {
  samples: number;
  /** Per metric: the p75 over every page, its rating, and the share of visits that were good. */
  overall: { metric: MetricName; p75: number | null; rating: Rating | null; good: number | null; n: number }[];
  /** Per kind of page, busiest first. */
  pages: { page: PageGroup; views: number; lcp: number | null; inp: number | null; cls: number | null }[];
  /** LCP p75 on phones and on computers. */
  devices: { label: string; lcp: number | null; n: number }[];
};

export function summarizeSpeed(vitals: Vital[], opts: { days: number; now?: Date }): SpeedSummary {
  const end = (opts.now ?? new Date()).getTime();
  const start = end - opts.days * 86_400_000;
  const v = vitals.filter((x) => {
    const t = new Date(x.occurredAt).getTime();
    return t > start && t <= end;
  });
  const values = (list: Vital[], m: MetricName) => list.filter((x) => x.metric === m).map((x) => x.value);
  const overall = METRICS.map((metric) => {
    const vals = values(v, metric);
    const p = p75(vals);
    return { metric, p75: p, rating: p == null ? null : rate(metric, p), good: vals.length ? vals.filter((x) => rate(metric, x) === 'good').length / vals.length : null, n: vals.length };
  });
  const pages = PAGES.map((page) => {
    const list = v.filter((x) => x.page === page);
    // Every page view sends a TTFB, so its count is the number of views measured.
    return { page, views: values(list, 'TTFB').length || values(list, 'LCP').length, lcp: p75(values(list, 'LCP')), inp: p75(values(list, 'INP')), cls: p75(values(list, 'CLS')) };
  })
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views);
  const devices = [
    { label: 'Phones', list: v.filter((x) => x.device === 'phone') },
    { label: 'Tablets', list: v.filter((x) => x.device === 'tablet') },
    { label: 'Computers', list: v.filter((x) => x.device === 'desktop') },
  ]
    .map((d) => ({ label: d.label, lcp: p75(values(d.list, 'LCP')), n: values(d.list, 'LCP').length }))
    .filter((d) => d.n > 0);
  return { samples: values(v, 'TTFB').length || values(v, 'LCP').length, overall, pages, devices };
}
