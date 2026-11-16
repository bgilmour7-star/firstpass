// Loading screens (navigation speed, 2026-11-16): each section's loading.tsx shows the page's shape in
// grey straight away, so a tap changes the screen at once while the server works. Shapes only, no
// words that could turn out wrong; screen readers hear "Loading".

/** One grey block. Size it with width and height classes. */
export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-md bg-surface-200 motion-safe:animate-pulse ${className}`} />;
}

function Frame({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return (
    <div aria-busy="true" className={`mx-auto flex w-full flex-col gap-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <span className="sr-only" role="status">
        Loading
      </span>
      {children}
    </div>
  );
}

/** A page title with one line under it, and buttons on the right. */
function Header({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-36" />
        <Bone className="h-8 w-72 max-w-full" />
        <Bone className="h-4 w-96 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-11 w-24 rounded-full" />
          ))}
        </div>
      )}
    </div>
  );
}

/** A drill row: time, diagram thumb, name and a line. */
function DrillRow() {
  return (
    <div className="grid grid-cols-[44px_96px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border-100 p-2 sm:grid-cols-[52px_132px_minmax(0,1fr)] sm:gap-4">
      <Bone className="h-4 w-10 self-start" />
      <Bone className="aspect-[102/87] w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        <Bone className="h-5 w-40" />
        <Bone className="h-4 w-full max-w-sm" />
      </div>
    </div>
  );
}

function ThinRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-1">
      <Bone className="h-4 w-10" />
      <Bone className="h-4 w-24" />
    </div>
  );
}

/** Any page in the app: a title and a few rows. */
export function PageSkeleton() {
  return (
    <Frame>
      <Header />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-14 w-full" />
        ))}
      </div>
    </Frame>
  );
}

/** A practice: header with actions, drill rows and thin rows, and the drill panel on a computer. */
export function PracticeSkeleton() {
  return (
    <Frame wide>
      <Header actions={3} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <div className="flex flex-col gap-2">
          <ThinRow />
          <DrillRow />
          <ThinRow />
          <DrillRow />
          <DrillRow />
          <ThinRow />
          <DrillRow />
        </div>
        <div className="hidden flex-col gap-3 rounded-xl border border-border-100 p-4 lg:flex">
          <Bone className="h-6 w-48" />
          <Bone className="aspect-[200/85] w-full rounded-lg" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-4/5" />
        </div>
      </div>
    </Frame>
  );
}

/** Home: title, the one thing to do, the next practice's drills, progress. */
export function HomeSkeleton() {
  return (
    <Frame wide>
      <Header />
      <Bone className="h-20 w-full rounded-xl" />
      <div className="flex flex-col gap-3">
        <Bone className="h-5 w-40" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="aspect-[102/87] w-40 shrink-0 rounded-lg lg:w-auto lg:flex-1" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Bone className="h-5 w-32" />
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-6 w-full max-w-2xl" />
        ))}
      </div>
    </Frame>
  );
}

/** The drill library: search and a grid of drill cards. */
export function DrillsSkeleton() {
  return (
    <Frame wide>
      <Header />
      <Bone className="h-11 w-full max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border-100 p-3">
            <Bone className="aspect-[200/85] w-full rounded-lg" />
            <Bone className="h-5 w-40" />
            <Bone className="h-4 w-full" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
