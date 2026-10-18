// The one email a coach gets 30 minutes after practice (decision 0010): a link to that practice's
// check-in. Plain words, no kids' names (there are none to include: teams store counts only).

export type CheckinEmailInput = {
  teamName: string;
  practiceDate: string; // YYYY-MM-DD, team time zone
  startTime: string; // HH:MM or HH:MM:SS
  nextDate: string | null; // the team's next practice, if one is known
  checkedIn: string[]; // co-coaches who already checked in, as they're shown ("Kara")
  checkinUrl: string;
  settingsUrl: string;
};

export type Email = { subject: string; html: string; text: string };

const day = (date: string) => new Date(date + 'T12:00:00Z');
const weekday = (date: string) => day(date).toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' });
const shortDate = (date: string) => day(date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const daysBetween = (a: string, b: string) => Math.round((day(b).getTime() - day(a).getTime()) / 86_400_000);

export function clock(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Thursday's plan" when the next practice is within the week, "the Oct 30 plan" further out. */
export function nextPlanPhrase(practiceDate: string, nextDate: string | null): string {
  if (!nextDate) return 'your next plan';
  const gap = daysBetween(practiceDate, nextDate);
  if (gap >= 1 && gap <= 6) return `${weekday(nextDate)}’s plan`;
  return `the plan for ${shortDate(nextDate)}`;
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function checkinEmail(i: CheckinEmailInput): Email {
  const subject = `How did ${weekday(i.practiceDate)}’s practice go?`;
  const lead = `About 20 seconds. Your answers shape ${nextPlanPhrase(i.practiceDate, i.nextDate)}.`;
  const already = i.checkedIn.length
    ? `${listNames(i.checkedIn)} ${i.checkedIn.length === 1 ? 'has' : 'have'} checked in already. Your answers sit beside theirs; they’re never averaged.`
    : '';
  const footer = `${i.teamName} · ${shortDate(i.practiceDate)}, ${clock(i.startTime)}. One email per practice.`;

  const text = [subject, '', lead, '', `Check in: ${i.checkinUrl}`, ...(already ? ['', already] : []), '', '—', footer, `Turn these emails off on your Team page: ${i.settingsUrl}`].join('\n');

  // Inline styles only: email clients ignore stylesheets. Colours are the design-system tokens
  // (ink-100, ink-200, rink-100, surface-200) written out, since emails can't read CSS variables.
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F3F6F7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F7;"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;">
<tr><td style="padding:28px 28px 8px;font:700 15px/1.2 Helvetica,Arial,sans-serif;color:#0C6E8F;">Firstpass</td></tr>
<tr><td style="padding:8px 28px 0;font:700 22px/1.3 Helvetica,Arial,sans-serif;color:#0E1B1E;">${esc(subject)}</td></tr>
<tr><td style="padding:10px 28px 0;font:16px/1.5 Helvetica,Arial,sans-serif;color:#0E1B1E;">${esc(lead)}</td></tr>
<tr><td style="padding:22px 28px 6px;"><a href="${esc(i.checkinUrl)}" style="display:inline-block;background:#0C6E8F;color:#FFFFFF;text-decoration:none;font:600 16px/1 Helvetica,Arial,sans-serif;padding:14px 26px;border-radius:999px;">Check in</a></td></tr>
${already ? `<tr><td style="padding:14px 28px 0;font:14px/1.5 Helvetica,Arial,sans-serif;color:#51646A;">${esc(already)}</td></tr>` : ''}
<tr><td style="padding:24px 28px 28px;font:13px/1.5 Helvetica,Arial,sans-serif;color:#51646A;border-top:1px solid #F3F6F7;">${esc(footer)}<br><a href="${esc(i.settingsUrl)}" style="color:#51646A;">Turn these emails off</a> on your Team page.</td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html, text };
}
