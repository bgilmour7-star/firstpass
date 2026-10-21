import type { Drill } from '@/lib/drills/schema';

// How a drill is organised, in plain words with a small picture (decision 0024). Coaches found
// "rotation" and "stations" hard to tell apart, so the words say what the kids do:
//   rotation  Everyone rotates: every group does all the zones, one after another
//   stations  Split by skill: each skill group plays its own version, at the same time
//   basic     Whole group: everyone does it together

type Model = Drill['groupModel'];

export const FORMAT_NAME: Record<Model, string> = { rotation: 'Everyone rotates', stations: 'Split by skill', basic: 'Whole group' };

export function formatWhat(model: Model, zones = 3): string {
  if (model === 'rotation') return `Every group does all ${zones} zones, one after another`;
  if (model === 'stations') return 'Each skill group plays its own version, at the same time';
  return 'Everyone does it together';
}

export function FormatIcon({ model, className = '' }: { model: Model; className?: string }) {
  if (model === 'rotation')
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" className={`shrink-0 ${className}`}>
        <rect x="1" y="5" width="5" height="6" rx="1.2" fill="currentColor" />
        <rect x="8.5" y="5" width="5" height="6" rx="1.2" fill="currentColor" opacity=".6" />
        <rect x="16" y="5" width="5" height="6" rx="1.2" fill="currentColor" opacity=".35" />
        <path d="M3.5 3.6C6 .9 16 .9 18.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M17 1.8l1.7 1.9-2.5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (model === 'stations')
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" className={`shrink-0 ${className}`}>
        <rect x="1" y="9" width="5" height="6" rx="1.2" fill="currentColor" opacity=".45" />
        <rect x="8.5" y="5.5" width="5" height="9.5" rx="1.2" fill="currentColor" opacity=".7" />
        <rect x="16" y="1.5" width="5" height="13.5" rx="1.2" fill="currentColor" />
      </svg>
    );
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="1" y="3" width="20" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="8" r="1.5" fill="currentColor" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" />
      <circle cx="15" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** "[picture] Everyone rotates" as one inline label. */
export function FormatLabel({ model, className = '' }: { model: Model; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FormatIcon model={model} />
      {FORMAT_NAME[model]}
    </span>
  );
}
