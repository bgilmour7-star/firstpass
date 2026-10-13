'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../design-system/index';

const RD = firstpass.RinkDiagram as RinkDiagramApi;
const Pip = firstpass.Pips as { render(level: number, opts?: { size?: 'sm' | 'lg'; label?: string }): string };

// The design-system renderer escapes all text it draws, so its SVG string is safe to inject.

export function Rink({ spec, title, detail = 'full', className = '' }: { spec: RinkDiagramProps; title: string; detail?: 'full' | 'thumb'; className?: string }) {
  const svg = useMemo(() => RD.render({ ...spec, title, detail }), [spec, title, detail]);
  return <div className={`rink-frame ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Pips({ level, label }: { level: 0 | 1 | 2; label?: string }) {
  return <span dangerouslySetInnerHTML={{ __html: Pip.render(level, { label }) }} />;
}

// Step-through, opening on "All" (design decision), plus "Play for the kids".
export function RinkStepper({ spec, title }: { spec: RinkDiagramProps; title: string }) {
  const steps = useMemo(() => RD.steps(spec), [spec]);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState('');
  const playRef = useRef<HTMLDivElement>(null);
  const anim = useRef<{ stop(): void } | null>(null);

  useEffect(() => () => anim.current?.stop(), []);

  const view = active == null ? spec : { ...spec, activeStep: active };
  const current = active == null ? null : steps.find((s) => Number(s.step) === active);

  function play() {
    if (!playRef.current) return;
    setPlaying(true);
    setActive(null);
    requestAnimationFrame(() => {
      if (!playRef.current) return;
      const a = RD.animate(playRef.current, spec, {
        onStep: (_n, c) => setCaption(c),
        onDone: () => {
          setPlaying(false);
          setCaption('');
        },
      });
      anim.current = a;
      a.play();
    });
  }
  function stop() {
    anim.current?.stop();
    setPlaying(false);
    setCaption('');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border-100 bg-[var(--rink-ice)] p-2">
        {playing ? <div ref={playRef} className="rink-frame" /> : <Rink spec={view} title={title} />}
        {!playing && <div ref={playRef} hidden />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Step through the drill" className="inline-flex rounded-full border border-border-100 bg-surface-200 p-0.5">
          <StepButton on={active == null && !playing} onClick={() => { stop(); setActive(null); }}>All</StepButton>
          {steps.map((s) => (
            <StepButton key={String(s.step)} on={active === Number(s.step)} onClick={() => { stop(); setActive(Number(s.step)); }}>
              {String(s.step)}
            </StepButton>
          ))}
        </div>
        <button type="button" onClick={playing ? stop : play} className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-100 px-3 text-sm font-medium hover:bg-surface-200">
          {playing ? 'Stop' : 'Play for the kids'}
        </button>
      </div>
      <p className="min-h-5 text-sm text-ink-200" aria-live="polite">
        {playing ? caption : current ? `${current.step}. ${current.caption}` : `${steps.length} steps. Pick one to walk through it.`}
      </p>
    </div>
  );
}

function StepButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-8 min-w-9 rounded-full px-3 font-mono text-[13px] ${on ? 'bg-ink-100 text-surface-100' : 'text-ink-100 hover:bg-surface-300'}`}
    >
      {children}
    </button>
  );
}
