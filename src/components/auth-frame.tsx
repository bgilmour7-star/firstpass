import puckParty from '../../content/drills/rotation-puck-party.json';
import { Rink } from './ds';
import { Mark } from './app-shell';
import type { RinkDiagramProps } from '../../design-system/index';

// The frame for signing in, creating an account and joining (decision 0013). The form column is
// the whole screen on a phone. On a desktop a rink-200 panel sits beside it, showing a real
// rotation from the library, drawn by RinkDiagram: diagrams are the brand's imagery, never photos.
export function AuthFrame({ children, panel = true }: { children: React.ReactNode; panel?: boolean }) {
  return (
    <div className={`min-h-dvh bg-surface-100 text-ink-100 ${panel ? 'lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]' : ''}`}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pb-7 pt-5 lg:max-w-none lg:px-16 lg:pt-10">
        <p className="flex h-11 items-center gap-2 font-display text-xl font-extrabold tracking-[-0.01em]">
          <Mark />
          Firstpass
        </p>
        <div className="flex flex-1 flex-col lg:max-w-[400px]">{children}</div>
        <p className="mt-8 text-xs leading-[17px] text-ink-200">Firstpass keeps team details only, never kids&apos; names.</p>
      </main>
      {panel && (
        <aside aria-label="An example from the drill library" className="hidden flex-col justify-center gap-6 bg-rink-200 px-[72px] py-16 lg:flex">
          <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-surface-100">
            <Rink spec={puckParty.diagram as unknown as RinkDiagramProps} title="Puck Party" />
          </div>
          <div className="flex max-w-[520px] flex-col gap-1 text-surface-100">
            <span className="font-mono text-[13px] text-surface-100/80">Example · 18 min</span>
            <span className="font-display text-2xl font-bold">Puck Party</span>
            <span className="text-[15px] leading-[22px] text-surface-100/80">Three zones on half ice. Groups move on the whistle.</span>
          </div>
        </aside>
      )}
    </div>
  );
}
