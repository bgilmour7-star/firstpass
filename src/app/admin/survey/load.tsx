import 'server-only';
import { getDiscoveryStore } from '@/lib/discovery/store';
import type { Note, Person, SurveyResponse, Usage } from '@/lib/discovery/schema';

// Shared by Admin → Survey and Coaches. Callers run requireAnalytics() first.

export type Discovery = { people: Person[]; responses: SurveyResponse[]; notes: Note[]; themes: string[]; usage: Usage[]; missing: boolean };

export async function loadDiscovery(): Promise<Discovery> {
  const store = await getDiscoveryStore();
  try {
    const [people, responses, notes, themes, usage] = await Promise.all([store.people(), store.responses(), store.notes(), store.themes(), store.usage()]);
    return { people, responses, notes, themes, usage, missing: false };
  } catch (e) {
    if (e instanceof Error && e.message === 'discovery-migration-missing') return { people: [], responses: [], notes: [], themes: [], usage: [], missing: true };
    throw e;
  }
}

export function MigrationMissing() {
  return (
    <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
      The discovery tables aren’t set up yet. Run <code className="font-mono">supabase/migrations/20261029000000_discovery.sql</code> in the Supabase SQL editor, then reload.
    </p>
  );
}

export const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Vancouver' });
