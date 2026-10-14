import { notFound } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { drillIds } from '@/lib/plans/schema';
import { Builder } from './builder';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string }> }) {
  const { team } = await requireTeam('/plans');
  const { id } = await params;
  const { copied } = await searchParams;
  const store = await getAppStore();
  const practice = await store.getPractice(id);
  if (!practice || practice.teamId !== team.id) notFound();
  const [all, drills, share] = await Promise.all([store.listPractices(team.id), store.libraryDrills(), store.activeShare(practice.id)]);
  // Drills the kids have done before this practice ("known"), for the New tag and the library drawer.
  const known = [...new Set(all.filter((p) => p.id !== practice.id && p.date < practice.date).flatMap((p) => p.blocks.flatMap(drillIds)))];
  return <Builder initial={practice} team={team} drills={drills} known={known} copiedFrom={copied ?? null} initialShare={share} />;
}
