import { notFound } from 'next/navigation';
import { getDrillStore } from '@/lib/drills/store';
import { DrillReview } from './review';

export const dynamic = 'force-dynamic';

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await (await getDrillStore()).get(id);
  if (!detail) notFound();
  return <DrillReview detail={detail} />;
}
