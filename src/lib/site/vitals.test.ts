import { describe, expect, it } from 'vitest';
import { formatVital, p75, pageGroup, rate, summarizeSpeed, vitalsInput, type Vital } from './vitals';

const NOW = new Date('2026-10-20T19:00:00Z');
const at = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const v = (metric: Vital['metric'], value: number, extra: Partial<Vital> = {}): Vital => ({ occurredAt: at(1), metric, value, page: 'Planner', device: 'phone', ...extra });

describe('page speed', () => {
  it('groups paths into kinds of page, without ids', () => {
    expect(pageGroup('/')).toBe('Landing');
    expect(pageGroup('/plans')).toBe('Plans');
    expect(pageGroup('/plans/4b1e/')).toBe('Planner');
    expect(pageGroup('/plans/4b1e/check-in')).toBe('Check-in');
    expect(pageGroup('/plans/4b1e/print')).toBe('Other');
    expect(pageGroup('/p/abc123')).toBe('Parent link');
    expect(pageGroup('/admin/analytics?days=7')).toBe('Admin');
  });

  it('takes the 75th percentile and rates it on Google’s lines', () => {
    expect(p75([])).toBeNull();
    expect(p75([100, 200, 300, 400])).toBe(300);
    expect(p75([5])).toBe(5);
    expect(rate('LCP', 2500)).toBe('good');
    expect(rate('LCP', 3000)).toBe('needs-work');
    expect(rate('INP', 600)).toBe('poor');
    expect(rate('CLS', 0.05)).toBe('good');
    expect(formatVital('LCP', 1840)).toBe('1.8 s');
    expect(formatVital('INP', 96.4)).toBe('96 ms');
    expect(formatVital('CLS', 0.031)).toBe('0.03');
  });

  it('summarizes the period by metric, page and device', () => {
    const s = summarizeSpeed(
      [
        v('TTFB', 300), v('TTFB', 400), v('TTFB', 350, { page: 'Landing', device: 'desktop' }),
        v('LCP', 1200), v('LCP', 5000), v('LCP', 900, { page: 'Landing', device: 'desktop' }),
        v('INP', 80), v('CLS', 0.02),
        v('LCP', 9000, { occurredAt: at(10) }),
      ],
      { days: 7, now: NOW },
    );
    expect(s.samples).toBe(3);
    const lcp = s.overall.find((o) => o.metric === 'LCP')!;
    expect(lcp).toMatchObject({ n: 3, p75: 5000, rating: 'poor' });
    expect(lcp.good).toBeCloseTo(2 / 3);
    expect(s.pages.map((p) => [p.page, p.views])).toEqual([['Planner', 2], ['Landing', 1]]);
    expect(s.devices).toEqual([{ label: 'Phones', lcp: 5000, n: 2 }, { label: 'Computers', lcp: 900, n: 1 }]);
  });

  it('accepts only known metrics and sane values', () => {
    expect(vitalsInput.safeParse({ path: '/', metrics: [{ name: 'LCP', value: 1200 }] }).success).toBe(true);
    expect(vitalsInput.safeParse({ path: '/', metrics: [{ name: 'FID', value: 10 }] }).success).toBe(false);
    expect(vitalsInput.safeParse({ path: '/', metrics: [{ name: 'LCP', value: -1 }] }).success).toBe(false);
    expect(vitalsInput.safeParse({ path: '/', metrics: [] }).success).toBe(false);
  });
});
