import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAnalytics } from '@/lib/auth';
import { Survey } from '../../[token]/survey';

// Brett's preview of the discovery survey (decision 0027), linked from Admin → Survey. The same
// screens a waitlist sign-up or a coach sees, with a sample email; nothing is saved. Brett only.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Survey preview · Firstpass', robots: { index: false, follow: false } };

export default async function SurveyPreviewPage({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  if (audience !== 'waitlist' && audience !== 'coach') notFound();
  await requireAnalytics(`/s/preview/${audience}`);
  return <Survey token="preview" audience={audience} email="you@example.com" preview />;
}
