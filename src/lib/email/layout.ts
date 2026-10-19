// The one frame every Firstpass email uses (decision 0013): the "Puck to teammate" lockup, a white
// card on surface-200, one pill button, and a footer that says why you got it. Check-in, invite,
// coach-joined, and the Supabase sign-in templates (scripts/email-templates.ts) all go through this,
// so they look like one product.
//
// Inline styles and tables only: email clients ignore stylesheets and flexbox. Colours are the
// design-system tokens written out (emails can't read CSS variables). Fonts fall back to Helvetica
// in clients that won't load web fonts, which is most of them.

export type Email = { subject: string; html: string; text: string };

export const SITE = process.env.SITE_URL ?? 'https://firstpass.coach';
export const FROM = 'Firstpass <hello@firstpass.coach>';
export const TAGLINE = 'Firstpass · Practice plans for U7 and U9 hockey · Nanaimo, BC';

const INK = '#0E1B1E';
const INK2 = '#51646A';
const RINK = '#0C6E8F';
const GROUND = '#F3F6F7';
const BODY = "'Lexend',Helvetica,Arial,sans-serif";
const DISPLAY = "'Bricolage Grotesque',Helvetica,Arial,sans-serif";

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Shell = {
  /** Shown as the inbox preview line. Plain text. */
  preheader: string;
  /** Plain text heading. */
  heading: string;
  /** Paragraphs, already HTML-safe (use esc()). Each becomes its own row. */
  paragraphs: string[];
  /** A big code, shown in a grey box ("481 920"). Already HTML-safe. */
  code?: string;
  /** Paragraphs after the code and before the button. Already HTML-safe. */
  afterCode?: string[];
  button?: { label: string; url: string };
  /** Small grey text under the button. Already HTML-safe. */
  note?: string;
  /** Small grey lines in the footer, saying why this email came. Already HTML-safe. */
  footer: string[];
  /** Image base, so the logo resolves in Supabase templates as well as app emails. */
  site?: string;
};

export function shell(s: Shell): string {
  const site = s.site ?? SITE;
  const p = (html: string, top = 10) => `<tr><td style="padding:${top}px 32px 0;font:16px/24px ${BODY};color:${INK};">${html}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${esc(s.heading)}</title></head>
<body style="margin:0;padding:0;background:${GROUND};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(s.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:12px;">
<tr><td style="padding:26px 32px 0;"><img src="${site}/email/firstpass-lockup.png" width="134" height="21" alt="Firstpass" style="display:block;border:0;"></td></tr>
<tr><td style="padding:22px 32px 0;font:800 26px/31px ${DISPLAY};color:${INK};">${esc(s.heading)}</td></tr>
${s.paragraphs.map((h) => p(h)).join('\n')}
${s.code ? `<tr><td style="padding:18px 32px 0;"><div style="background:${GROUND};border-radius:10px;padding:18px 0;text-align:center;font:500 36px/1 'IBM Plex Mono','Courier New',monospace;letter-spacing:6px;color:${INK};">${s.code}</div></td></tr>` : ''}
${(s.afterCode ?? []).map((h) => p(h, 20)).join('\n')}
${s.button ? `<tr><td style="padding:22px 32px 0;"><a href="${s.button.url}" style="display:inline-block;background:${RINK};color:#FFFFFF;text-decoration:none;font:600 16px/1 ${BODY};padding:15px 28px;border-radius:999px;">${esc(s.button.label)}</a></td></tr>` : ''}
<tr><td style="padding:18px 32px 28px;font:13px/19px ${BODY};color:${INK2};">${s.note ?? ''}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:456px;"><tr><td style="padding:20px 0 8px;font:12px/18px ${BODY};color:${INK2};">
<div style="width:120px;border-top:1.5px dashed #7F9095;margin:0 0 12px;"></div>
${[...s.footer, esc(TAGLINE)].map((l) => `<p style="margin:0 0 8px;">${l}</p>`).join('\n')}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/** Send through Resend. Returns false (and logs) instead of throwing: an email never blocks the action that sent it. */
export async function sendEmail(to: string, email: Email, tag: string, idempotencyKey?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('[email] RESEND_API_KEY is not set; skipped %s', tag);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
    body: JSON.stringify({ from: FROM, to: [to], subject: email.subject, html: email.html, text: email.text, tags: [{ name: 'kind', value: tag }] }),
  }).catch(() => null);
  if (res?.ok) return true;
  console.error('[email] %s failed: %s', tag, res ? `${res.status} ${await res.text().catch(() => '')}` : 'network');
  return false;
}
