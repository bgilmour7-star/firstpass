'use server';

import { requireAnalytics } from '@/lib/auth';
import { FROM_BRETT, sendEmail } from '@/lib/email/layout';
import { entry } from '@/lib/email/journeys';

/** Send me a test (canvas A3): the selected email's sample, to the signed-in admin only. */
export async function sendTest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAnalytics('/admin/emails');
  const e = entry(id);
  if (!e) return { ok: false, error: 'That email isn’t in the registry.' };
  if (admin.local) return { ok: false, error: 'Local mode has no email. Run with Supabase and RESEND_API_KEY to send a test.' };
  const email = e.preview();
  const ok = await sendEmail(admin.email, { ...email, subject: `[Test] ${email.subject}` }, `test-${e.id}`, { from: e.from.startsWith('Brett') ? FROM_BRETT : undefined });
  return ok ? { ok: true } : { ok: false, error: 'Couldn’t send. Check RESEND_API_KEY in Vercel.' };
}
