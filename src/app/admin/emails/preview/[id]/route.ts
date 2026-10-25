import { notFound } from 'next/navigation';
import { requireAnalytics } from '@/lib/auth';
import { entry } from '@/lib/email/journeys';

// "Open full size" on Admin → Emails: the sample email as its own page. Brett only.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAnalytics('/admin/emails');
  const e = entry(decodeURIComponent((await params).id));
  if (!e) notFound();
  return new Response(e.preview().html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "script-src 'none'" } });
}
