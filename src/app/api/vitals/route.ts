import { NextResponse, type NextRequest } from 'next/server';
import { deviceOf, isBot } from '@/lib/site/schema';
import { getSiteStore } from '@/lib/site/store';
import { pageGroup, vitalsInput } from '@/lib/site/vitals';

// Page speed from real visits (decision 0025). The browser posts a few numbers when a page is
// hidden or closed. Open to signed-out visitors (the landing page); nothing about the visitor is
// kept but the kind of device. Always answers 204 so a beacon never retries.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const agent = request.headers.get('user-agent');
    if (isBot(agent)) return new NextResponse(null, { status: 204 });
    const parsed = vitalsInput.safeParse(JSON.parse(await request.text()));
    if (parsed.success) await (await getSiteStore()).recordVitals(pageGroup(parsed.data.path), deviceOf(agent), parsed.data.metrics);
  } catch (e) {
    console.error('[vitals] failed:', e instanceof Error ? e.message : e);
  }
  return new NextResponse(null, { status: 204 });
}
