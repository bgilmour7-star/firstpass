'use client';

import { useEffect, useRef, useState } from 'react';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../../design-system/index';

// The hero rink plays its drill once when it comes into view (brand moment 2, canvas "Brand
// moments"): the same "Play for the kids" animation coaches use at the bench, with each zone's
// caption underneath. The drawing arrives from the server already rendered, so the page works
// without JavaScript, and nobody who asks their device for reduced motion sees it move unless they
// press Play.
const RD = firstpass.RinkDiagram as RinkDiagramApi;
const DONE = 'Every zone at once, every group busy. Whistle every 4 minutes.';

export function HeroRink({ svg, spec, title }: { svg: string; spec: RinkDiagramProps; title: string }) {
  const still = useRef<HTMLDivElement>(null);
  // The animation draws into its own empty layer: React never writes into it, so a re-render can't
  // wipe the drawing mid-play.
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<{ play(): void; stop(): void } | null>(null);
  const [caption, setCaption] = useState(DONE);
  const [state, setState] = useState<'idle' | 'playing' | 'done'>('idle');

  function play() {
    const el = stage.current;
    if (!el) return;
    player.current?.stop();
    player.current = RD.animate(el, { ...spec, title }, {
      onStep: (_n, c) => setCaption(c),
      onDone: () => {
        setCaption(DONE);
        setState('done');
      },
    });
    setState('playing');
    player.current.play();
  }

  useEffect(() => {
    const el = still.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        timer = setTimeout(play, 500);
      },
      { threshold: 0.5 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      clearTimeout(timer);
      player.current?.stop();
    };
    // Plays once, on first view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div ref={still} className="rink-frame" hidden={state === 'playing'} dangerouslySetInnerHTML={{ __html: svg }} />
      <div ref={stage} className="rink-frame" hidden={state !== 'playing'} />
      <div className="flex flex-col sm:max-w-[58%] items-start gap-1.5">
        <p aria-live="polite" className="min-h-[44px] text-[15px] leading-snug">
          {caption}
        </p>
        {/* Always there, so the layout doesn't jump; only hidden while it plays. */}
        <button type="button" onClick={play} className={`min-h-11 text-sm font-medium text-rink-100 underline underline-offset-[3px] hover:text-rink-200 ${state === 'playing' ? 'invisible' : ''}`}>
          {state === 'done' ? 'Play it again' : 'Play the drill'}
        </button>
      </div>
    </div>
  );
}
