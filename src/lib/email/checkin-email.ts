import { esc, shell, type Email } from './layout';

export type { Email };

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


export function checkinEmail(i: CheckinEmailInput): Email {
  const subject = `How did ${weekday(i.practiceDate)}’s practice go?`;
  const lead = `About 20 seconds. Your answers shape ${nextPlanPhrase(i.practiceDate, i.nextDate)}.`;
  const already = i.checkedIn.length
    ? `${listNames(i.checkedIn)} ${i.checkedIn.length === 1 ? 'has' : 'have'} checked in already. Your answers sit beside theirs; they’re never averaged.`
    : '';
  const footer = `${i.teamName} · ${shortDate(i.practiceDate)}, ${clock(i.startTime)}. One email per practice.`;

  const text = [subject, '', lead, '', `Check in: ${i.checkinUrl}`, ...(already ? ['', already] : []), '', '—', footer, `Turn these emails off on your Team page: ${i.settingsUrl}`].join('\n');

  // Same branded frame as every other Firstpass email (layout.ts).
  const html = shell({
    preheader: lead,
    heading: subject,
    paragraphs: [esc(lead)],
    button: { label: 'Check in', url: esc(i.checkinUrl) },
    note: already ? esc(already) : '',
    footer: [esc(footer), `<a href="${esc(i.settingsUrl)}" style="color:#51646A;">Turn these emails off</a> on your Team page.`],
  });

  return { subject, html, text };
}
