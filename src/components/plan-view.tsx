import { Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { addMinutes, blockMinutes, clock, rotation, startTimes, type Block } from '@/lib/plans/schema';

// Read-only plan in time order, for the printout and the parent link. The practice is the
// hierarchy: top-level blocks, with Stations as a section whose station drills sit beneath it.

type Mode = 'print' | 'parent';

export function PlanView({ blocks, startTime, groups, drills, mode }: { blocks: Block[]; startTime: string; groups: string[]; drills: Map<string, Drill>; mode: Mode }) {
  const times = startTimes(startTime, blocks);
  return (
    <ol className="flex flex-col">
      {blocks.map((b, i) => (
        <li key={b.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-t-2 border-ink-100 py-3 break-inside-avoid">
          <div className="flex flex-col">
            <span className="font-mono text-[15px] font-medium">{clock(times[i])}</span>
            <span className="font-mono text-xs text-ink-200">{blockMinutes(b)} min</span>
          </div>
          <div className="min-w-0">
            {b.kind === 'activity' && (
              <div>
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
                {b.note && mode === 'print' && <p className="text-[15px]">{b.note}</p>}
              </div>
            )}
            {b.kind === 'drill' && <DrillBlock drill={drills.get(b.drillId)} mode={mode} />}
            {b.kind === 'stations' && (
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-lg font-bold">Stations</h3>
                <p className="text-[15px] text-ink-200">
                  {mode === 'parent'
                    ? `Kids rotate through ${b.stations.length} stations in their skill groups, ${b.minutes} minutes each.`
                    : `${b.stations.length} stations, ${b.minutes} min each. Rotate on the whistle.`}
                </p>
                <ul className="flex flex-col">
                  {b.stations.map((s) => (
                    <li key={s.station} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2 border-t border-border-100 py-2 break-inside-avoid">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 font-mono text-xs text-surface-100">{s.station}</span>
                      <div>
                        <DrillBlock drill={s.drillId ? drills.get(s.drillId) : undefined} mode={mode} small />
                        {mode === 'print' && s.coach && <p className="text-sm text-ink-200">{s.coach}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                {mode === 'print' && groups.length > 1 && (
                  <table className="w-full border-collapse text-[15px]">
                    <thead>
                      <tr>
                        <th className="py-1 text-left font-normal text-ink-200">Starts</th>
                        {b.stations.map((s) => (
                          <th key={s.station} className="py-1 text-left font-mono">
                            {s.station}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rotation(groups, b.stations.length).map((row, r) => (
                        <tr key={r} className="border-t border-border-100">
                          <td className="py-1 font-mono">{clock(addMinutes(times[i], b.minutes * r))}</td>
                          {row.map((g, c) => (
                            <td key={c} className="py-1">
                              {g}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
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
