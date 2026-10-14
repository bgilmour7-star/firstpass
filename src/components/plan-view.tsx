import { Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { blockMinutes, clock, levelFor, rotationToday, startTimes, unusedZones, zoneFor, ZONES, type Block, type Unit } from '@/lib/plans/schema';
import type { RinkDiagramProps } from '../../design-system/index';

// Read-only plan in time order, for the printout and the parent link, adapted to today's groups.

type Mode = 'print' | 'parent';

export function PlanView({ blocks, startTime, units, drills, mode }: { blocks: Block[]; startTime: string; units: Unit[]; drills: Map<string, Drill>; mode: Mode }) {
  const gc = units.length;
  const times = startTimes(startTime, blocks, gc);
  return (
    <ol className="flex flex-col">
      {blocks.map((b, i) => (
        <li key={b.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-t-2 border-ink-100 py-3 break-inside-avoid">
          <div className="flex flex-col">
            <span className="font-mono text-[15px] font-medium">{clock(times[i])}</span>
            <span className="font-mono text-xs text-ink-200">{blockMinutes(b, gc)} min</span>
          </div>
          <div className="min-w-0">
            {b.kind === 'activity' && (
              <div>
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
                {b.note && mode === 'print' && <p className="text-[15px]">{b.note}</p>}
              </div>
            )}
            {b.kind === 'drill' && <DrillBlock drill={drills.get(b.drillId)} mode={mode} />}
            {b.kind === 'drill' && mode === 'print' && drills.get(b.drillId)?.levels?.length ? (
              <ul className="mt-2 flex flex-col text-[15px]">
                {units.map((u) => {
                  const d = drills.get(b.drillId)!;
                  const lv = levelFor(d, u, b.levels);
                  const l = d.levels!.find((x) => x.level === lv);
                  return (
                    <li key={u.key} className="border-t border-border-100 py-1">
                      <b>{u.label}</b> · <span className="font-mono">{lv}</span> {l?.name}
                      {l?.adds ? <span className="text-ink-200"> ({l.adds})</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {b.kind === 'stations' && <StationsView block={b} drill={drills.get(b.drillId)} units={units} mode={mode} />}
            {b.kind === 'rotation' && <RotationView block={b} drills={drills} gc={gc} mode={mode} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StationsView({ block, drill, units, mode }: { block: Extract<Block, { kind: 'stations' }>; drill?: Drill; units: Unit[]; mode: Mode }) {
  if (!drill) return <p className="text-[15px] text-ink-200">Drill to be chosen.</p>;
  const unused = unusedZones(drill, units, block.zones);
  const who = (z: string) => units.filter((u, i) => zoneFor(drill, u, block.zones, i) === z).map((u) => u.label).join(', ');
  if (mode === 'parent')
    return (
      <div>
        <h4 className="font-display text-lg font-bold">{drill.funName}</h4>
        <p className="text-[15px] text-ink-200">{drill.plainName}. Each group plays at its own station.</p>
      </div>
    );
  const spec = { ...drill.diagram, ...(drill.diagram.stations?.layout === 'halfice' ? { unused, stations: { ...drill.diagram.stations, groups: ZONES.map((z) => who(z) || '—') } } : {}) } as RinkDiagramProps;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_220px] items-start gap-3">
      <div className="min-w-0">
        <h4 className="font-display text-lg font-bold">{drill.funName}</h4>
        <ul className="flex flex-col text-[15px]">
          {(drill.stations ?? []).map((s) => (
            <li key={s.station} className={`border-t border-border-100 py-1 ${unused.includes(s.station) ? 'text-ink-200' : ''}`}>
              <b className="font-mono">{s.station}</b> · {who(s.station) ? <b>{who(s.station)}</b> : 'Not used today'} {who(s.station) && `· ${s.version}`}
            </li>
          ))}
        </ul>
        <p className="text-[15px] font-semibold">“{drill.cues[0]}”</p>
      </div>
      <Rink spec={spec} title={drill.funName} detail="print" />
    </div>
  );
}

function RotationView({ block, drills, gc, mode }: { block: Extract<Block, { kind: 'rotation' }>; drills: Map<string, Drill>; gc: number; mode: Mode }) {
  const { active } = rotationToday(block, gc);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-bold">Rotation</h3>
      <p className="text-[15px] text-ink-200">
        {mode === 'parent'
          ? `Kids rotate through ${active.length} stations in their groups, ${block.minutes} minutes each.`
          : `${active.length} stations, ${block.minutes} min each. Everyone does every station; whistle every ${block.minutes} min.`}
      </p>
      <ul className="flex flex-col">
        {active.map((s) => (
          <li key={s.station} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2 border-t border-border-100 py-2 break-inside-avoid">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 font-mono text-xs text-surface-100">{s.station}</span>
            <div>
              <DrillBlock drill={s.drillId ? drills.get(s.drillId) : undefined} mode={mode} small />
              {mode === 'print' && s.coach && <p className="text-sm text-ink-200">{s.coach}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DrillBlock({ drill, mode, small }: { drill?: Drill; mode: Mode; small?: boolean }) {
  if (!drill) return <p className="text-[15px] text-ink-200">Drill to be chosen.</p>;
  if (mode === 'parent')
    return (
      <div>
        <h4 className={`font-display font-bold ${small ? 'text-base' : 'text-lg'}`}>{drill.funName}</h4>
        <p className="text-[15px] text-ink-200">{drill.plainName}</p>
      </div>
    );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_220px] items-start gap-3">
      <div className="min-w-0">
        <h4 className={`font-display font-bold ${small ? 'text-base' : 'text-lg'}`}>{drill.funName}</h4>
        <p className="text-[15px]">{drill.steps.join(' ')}</p>
        <p className="text-[15px] font-semibold">“{drill.cues[0]}”</p>
        {drill.gear !== 'None' && <p className="text-sm text-ink-200">Gear: {drill.gear}</p>}
      </div>
      <Rink spec={drill.diagram} title={drill.funName} detail="print" />
    </div>
  );
}
