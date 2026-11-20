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

/** "[picture] Together · 3 levels": the drill's shape with its picture. */
export function ShapeLabel({ drill, className = '' }: { drill: Pick<Drill, 'groupModel' | 'levels' | 'zones'>; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FormatIcon model={drill.groupModel} />
      {shapeLabel(drill)}
    </span>
  );
}
