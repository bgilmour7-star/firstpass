import { shapeLabel, type Drill } from '@/lib/drills/schema';

// How a drill is run, in one word and a small picture, on every drill and block (decisions 0024, 0048).
// "Station" is a place on the ice; the label says who moves:
//   rotation  Rotate        Everyone moves. A different drill at each station.
//   stations  Skill groups  Everyone stays. The same game at each station, easier or harder.
//   basic     Together      Everyone does one drill.

type Model = Drill['groupModel'];

export const FORMAT_NAME: Record<Model, string> = { rotation: 'Rotate', stations: 'Skill groups', basic: 'Together' };

export function formatWhat(model: Model, zones = 3): string {
  if (model === 'rotation') return zones === 1 ? 'Everyone together at one station' : `Everyone moves. Every group does all ${zones} stations, one after another`;
  if (model === 'stations') return 'Everyone stays. Each skill group plays its own version, at the same time';
  return 'Everyone does one drill together';
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function FormatIcon({ model, size = 16, className = '' }: { model: Model; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} {...stroke}>
      {model === 'rotation' ? (
        <>
          <path d="M21 12a9 9 0 0 1-15.5 6.2" />
          <path d="M3 12a9 9 0 0 1 15.5-6.2" />
          <polyline points="18 2 18.5 5.8 14.7 6.3" />
          <polyline points="6 22 5.5 18.2 9.3 17.7" />
        </>
      ) : model === 'stations' ? (
        <>
          <rect x="3" y="4" width="4.5" height="16" rx="1.5" />
          <rect x="9.75" y="4" width="4.5" height="16" rx="1.5" />
          <rect x="16.5" y="4" width="4.5" height="16" rx="1.5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="7" r="3" />
          <circle cx="5" cy="10" r="2.2" />
          <circle cx="19" cy="10" r="2.2" />
          <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M1.5 19a3.5 3.5 0 0 1 4.5-3.3" />
          <path d="M22.5 19a3.5 3.5 0 0 0-4.5-3.3" />
        </>
      )}
    </svg>
  );
}

/** "[picture] Rotate" as one inline label. */
export function FormatLabel({ model, className = '' }: { model: Model; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FormatIcon model={model} />
      {FORMAT_NAME[model]}
    </span>
  );
}

/** "[picture] Together (1)(2)(3)": the drill's shape with its picture, and level chips when it has levels. */
export function ShapeLabel({ drill, on, className = '' }: { drill: Pick<Drill, 'groupModel' | 'levels' | 'zones'>; on?: number[]; className?: string }) {
  const levels = drill.groupModel === 'basic' ? (drill.levels?.length ?? 0) + 1 : 0;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FormatIcon model={drill.groupModel} />
      {levels > 1 ? FORMAT_NAME.basic : shapeLabel(drill)}
      {levels > 1 && <LevelChips count={levels} on={on} className="ml-0.5" />}
    </span>
  );
}

/** "1 2 3": a drill's levels as small chips, like colour swatches on a product (decision 0049).
 *  Filled chips are the ones in use; with none given, all show as available. Display only. */
export function LevelChips({ count, on = [], className = '' }: { count: number; on?: number[]; className?: string }) {
  if (count < 2) return null;
  const label = on.length ? `Level${on.length > 1 ? 's' : ''} ${on.join(' and ')} of ${count}` : `${count} levels`;
  return (
    <span role="img" aria-label={label} className={`inline-flex items-center gap-1 ${className}`}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full border font-mono text-[11px] leading-none ${on.includes(n) ? 'border-rink-100 bg-rink-100 text-surface-100' : 'border-rink-100 text-rink-100'}`}
        >
          {n}
        </span>
      ))}
    </span>
  );
}
