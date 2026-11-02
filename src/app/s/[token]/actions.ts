'use server';

import { getDiscoveryStore } from '@/lib/discovery/store';
import { surveyAnswers, toRow } from '@/lib/discovery/schema';

export type SubmitSurveyResult = { ok: true } | { ok: false; error: string; field?: 'phone' };

/** Public: the token is the permission. The database marks it used and stops the rest of this person's survey emails. */
export async function submitSurvey(token: string, raw: unknown): Promise<SubmitSurveyResult> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9-]{6,64}$/.test(token)) return { ok: false, error: 'This survey link isn’t right. Use the button in the email.' };
  const parsed = surveyAnswers.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? 'Check your answers and try again.', field: issue?.path[0] === 'phone' ? 'phone' : undefined };
  }
  const store = await getDiscoveryStore();
  const invite = await store.invite(token);
  if (!invite) return { ok: false, error: 'This survey link isn’t right. Use the button in the email.' };
  try {
    const r = await store.submit(token, toRow(parsed.data, invite.audience));
    if (r === 'used') return { ok: false, error: 'You’ve already answered this one. Thank you!' };
    if (r === 'unknown') return { ok: false, error: 'This survey link isn’t right. Use the button in the email.' };
  } catch (e) {
    console.error('[survey] submit failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Something went wrong on our side. Try again in a minute, or reply to the email instead.' };
  }
  return { ok: true };
}
