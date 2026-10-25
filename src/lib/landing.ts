// Where a signed-in coach lands (decision 0026): their Team page, except on a phone on practice day,
// when rink-side Today opens instead. Pure, so it can be tested; the page supplies the facts.

const PHONE = /\b(iPhone|iPod|Android.+Mobile|Mobile Safari|Windows Phone)\b/i;

/** A phone, from the request's user agent. Tablets count as computers: they get the Team page. */
export function isPhone(userAgent: string | null | undefined): boolean {
  return !!userAgent && PHONE.test(userAgent);
}

export function landingPath(i: { phone: boolean; practiceToday: boolean }): '/team' | '/today' {
  return i.phone && i.practiceToday ? '/today' : '/team';
}
