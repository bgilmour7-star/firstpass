import { requireAnalytics } from '@/lib/auth';
import { surveyCsv } from '@/lib/discovery/summary';
import { loadDiscovery } from '../load';

// Download all answers (canvas A1). Brett only; carries emails and phone numbers, so never cached.
export const dynamic = 'force-dynamic';

export async function GET() {
  await requireAnalytics('/admin/survey');
  const { people, responses, usage } = await loadDiscovery();
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  return new Response(surveyCsv(responses, people, usage), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="firstpass-survey-${day}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
