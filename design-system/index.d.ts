/** A point on the rink, in feet. x: 0–200 from the left end boards; y: 0–85 from the top boards. */
export type RinkPoint = [number, number];

export interface RinkDiagramProps {
  /** Accessible name of the drawing. */
  title?: string;
  /** Appended to the accessible name: what happens in the drill, in one sentence. */
  description?: string;
  /** Canonical framing only: full ice, one half, or one U7 station zone. Chosen by what the drill covers. */
  scope?: 'full' | 'half' | 'zone';
  /** On a half-ice view: keep the whole half for context, dim the other U7 station zones and outline this one. Use for station cards. */
  highlight?: 'A' | 'B' | 'C';
  /** U7 station zones not in use today (fewer groups): what's drawn in them is dropped and the zone is greyed out. */
  unused?: ('A' | 'B' | 'C')[];
  /** Other drills sharing the ice (e.g. the other stations), drawn muted and grey beneath this one for context. */
  context?: RinkDiagramProps[];
  /** With scope 'zone': A = end-zone top corner, B = bottom corner, C = neutral strip (shown sideways). */
  zone?: 'A' | 'B' | 'C';
  /** Which half when scope is 'half'. Default 'right'. */
  side?: 'left' | 'right';
  /** 'thumb' tunes strokes and marks for library cards (≥ 96px wide); 'print' draws in black and firm greys for paper and PDF. */
  detail?: 'full' | 'thumb' | 'print';
  /** 'portrait' stands the rink up for phones; text and cones stay upright. Default 'landscape'. */
  orient?: 'landscape' | 'portrait';
  /** Step-through: earlier steps fade, later ones hide. Omit to show every step (the default view). */
  activeStep?: number;
  /** U7/U9 cross-ice station layout. */
  /** Station layout. 'halfice' (U7 standard): A top corner, B bottom corner, C neutral strip, on the half given by `side`. */
  stations?: { layout: 'halfice' | 'halves' | 'thirds' | 'quarters'; labels?: string[]; /** Starting skill group per station (e.g. Eagles, Bears, Sharks), never player names. */ groups?: string[]; minutes?: number[]; /** Badge text per station; default A/B/C for halfice, 1/2/3 otherwise. */ badges?: string[] };
  /** Dashed small-area boundaries. */
  areas?: { x: number; y: number; w: number; h: number }[];
  /** O attacker, X defender, F forward, D defenceman, C coach, G goalie. */
  players?: { role: 'O' | 'X' | 'F' | 'D' | 'C' | 'G'; x: number; y: number; label?: string }[];
  /** skate solid, puck wavy, pass dashed, shot double line, backward ticked. */
  paths?: { type: 'skate' | 'puck' | 'pass' | 'shot' | 'backward'; points: RinkPoint[]; end?: 'arrow' | 'stop'; team?: 'X'; step?: number | string; /** Shows and plays together with an earlier step. */ stepWith?: number; /** One plain sentence for step-through and animation. */ caption?: string; stepAt?: number; stepSide?: 'left' | 'right'; fromPlayer?: boolean; trimStart?: number; trimEnd?: number }[];
  piles?: { x: number; y: number }[];
  pucks?: { x: number; y: number }[];
  cones?: { x: number; y: number }[];
  /** Portable nets; facing = direction the mouth opens. */
  nets?: { x: number; y: number; facing?: 'left' | 'right' | 'up' | 'down' }[];
  labels?: { x: number; y: number; text: string; size?: number }[];
}

export interface RinkDiagramApi {
  render(spec: RinkDiagramProps): string;
  mount(el: Element, spec: RinkDiagramProps): Element;
  legend(spec: RinkDiagramProps | 'all'): string;
  /** Numbered steps with captions, for building a step-through control. */
  steps(spec: RinkDiagramProps): { step: number | string; caption: string }[];
  /** Plays the drill: players travel their paths, the puck follows passes and shots. Always landscape. */
  animate(el: Element, spec: RinkDiagramProps, opts?: { onStep?(step: number, caption: string): void; onDone?(): void }): { play(): void; stop(): void };
}

/** Focus level: 2 = Main, 1 = Some, 0 = none. */
export type FocusLevel = 0 | 1 | 2;
export type FocusAttribute = 'Skating' | 'Puck control' | 'Passing' | 'Shooting' | 'Game sense' | 'Effort & fun';
export interface PipsOptions {
  /** 'sm' (default) inside chips and summary rows; 'lg' in the drill "What it works on" list. */
  size?: 'sm' | 'lg';
  /** When the pips stand alone (no level word beside them), pass the attribute name to make them an image with an accessible label. */
  label?: string;
}
export interface PipsApi {
  render(level: FocusLevel, opts?: PipsOptions): string;
  levels: Record<FocusLevel, 'Main' | 'Some' | 'None'>;
}
