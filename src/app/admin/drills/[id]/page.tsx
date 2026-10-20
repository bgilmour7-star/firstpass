import { notFound } from 'next/navigation';
import { getDrillStore } from '@/lib/drills/store';
import { DrillReview } from './review';
import { getRequestStore } from '@/lib/requests/store';

export const dynamic = 'force-dynamic';

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await (await getDrillStore()).get(id);
  if (!detail) notFound();
  // The coach request that produced this drill, if any (decision 0018).
  const asked = (await getRequestStore().then((r) => r.all()).catch(() => [])).find((r) => r.kind === 'new' && r.drillId === id) ?? null;
  return <DrillReview detail={detail} asked={asked} />;
}
