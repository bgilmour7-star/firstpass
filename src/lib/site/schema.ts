import { z } from 'zod';

// The public site (decision 0019): the waitlist and cookie-free visit counts.

export const WAITLIST_KINDS = ['coach', 'association'] as const;
export const AGE_GROUPS = ['U5', 'U7', 'U9'] as const;
export const WAITLIST_STATUSES = ['new', 'emailed', 'call_booked', 'onboarded', 'not_a_fit'] as const;
export const WAITLIST_STATUS_LABEL: Record<WaitlistStatus, string> = {
  new: 'New',
  emailed: 'Emailed',
  call_booked: 'Call booked',
  onboarded: 'Onboarded',
  not_a_fit: 'Not a fit',
};
export const EVENTS = ['view', 'reached_form', 'form_start', 'signup'] as const;
export const DEVICES = ['phone', 'tablet', 'desktop'] as const;

export type WaitlistKind = (typeof WAITLIST_KINDS)[number];
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
export type EventName = (typeof EVENTS)[number];
export type Device = (typeof DEVICES)[number];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What the landing page's form sends. Fields that don't belong to the chosen path are dropped. */
export const waitlistInput = z
  .object({
    kind: z.enum(WAITLIST_KINDS),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .refine((e) => EMAIL.test(e), 'That email doesn’t look right. Check for a typo and try again.'),
    ageGroup: z.enum(AGE_GROUPS).optional(),
    orgName: z.string().trim().max(120).optional(),
    teamCount: z.coerce.number().int().min(1).max(500).optional(),
    source: z.string().max(60).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'association' && !v.orgName) ctx.addIssue({ code: 'custom', path: ['orgName'], message: 'Add your association’s name.' });
    if (v.kind === 'association' && !v.teamCount) ctx.addIssue({ code: 'custom', path: ['teamCount'], message: 'Roughly how many U5–U9 teams? A guess is fine.' });
  })
  .transform((v) => ({
    kind: v.kind,
    email: v.email,
    ageGroup: v.kind === 'coach' ? v.ageGroup ?? null : null,
    orgName: v.orgName || null,
    teamCount: v.kind === 'association' ? v.teamCount ?? null : null,
    source: cleanSource(v.source),
  }));
export type WaitlistInput = z.output<typeof waitlistInput>;

export type WaitlistEntry = {
  id: string;
  email: string;
  kind: WaitlistKind;
  ageGroup: string | null;
  orgName: string | null;
  teamCount: number | null;
  source: string | null;
  status: WaitlistStatus;
  createdAt: string;
};

export type PageEvent = { occurredAt: string; name: EventName; visitor: string; source: string | null; device: Device | null; region: string | null };

/** A link tag (?from=shared-ice) or a referring site, lower-case and short. Our own site doesn't count. */
export function cleanSource(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase().replace(/^www\./, '');
  if (!s || s.includes('firstpass.coach') || s === 'localhost') return null;
  return s.replace(/[^a-z0-9.\-_]/g, '').slice(0, 60) || null;
}

/** Search engines and link previews don't count as visits. */
export function isBot(agent: string | null | undefined): boolean {
  if (!agent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|vercel|curl|wget|python|node-fetch/i.test(agent);
}

export function deviceOf(agent: string | null | undefined): Device {
  const a = agent ?? '';
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(a)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(a)) return 'phone';
  return 'desktop';
}

/** "Nanaimo, BC" from Vercel's location headers; the country only when it isn't Canada. City level at most. */
export function regionOf(h: { city?: string | null; region?: string | null; country?: string | null }): string | null {
  const city = h.city ? safeDecode(h.city) : '';
  const parts = [city, h.region ?? ''].filter(Boolean);
  if (h.country && h.country !== 'CA') parts.push(h.country);
  return parts.length ? parts.join(', ').slice(0, 80) : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
