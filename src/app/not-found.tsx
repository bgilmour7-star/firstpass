import Link from 'next/link';
import { Mark } from '@/components/landing/mark';

// Any address that isn't a page (brand moment 5): the empty-state rink corner from the design
// system's BrandDevices, one line, one way back. "/" sends signed-in coaches on to their plans.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-100 text-ink-100">
      <header className="px-[clamp(16px,4vw,48px)] py-5">
        <Link href="/" aria-label="Firstpass home" className="inline-flex items-center gap-2.5">
          <Mark className="size-[30px]" />
          <span className="font-display text-2xl font-extrabold leading-none tracking-[-0.01em]">Firstpass</span>
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
        <svg width="190" height="78" viewBox="0 0 150 62" aria-hidden="true">
          <path d="M2 60V30A28 28 0 0 1 30 2H148" fill="none" stroke="var(--rink-boards)" strokeWidth="2" />
          <path d="M14 60V18" stroke="var(--rink-line-red)" strokeWidth="1.5" />
          <path d="M40 44 C 70 46, 96 36, 118 20" fill="none" stroke="var(--ink-100)" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" />
          <path d="M124 15 113 18.5 119 25z" fill="var(--ink-100)" />
          <path d="M33 34 41 49H25z" fill="var(--whistle-100)" />
          <circle cx="131" cy="12" r="6" fill="var(--surface-100)" stroke="var(--rink-100)" strokeWidth="2.2" />
        </svg>
        <h1 className="font-display text-[44px] font-extrabold leading-none tracking-[-0.02em]">Offside.</h1>
        <p className="max-w-[36ch] text-[17px] text-ink-200">This page isn’t on the ice. The link may be old, or it moved.</p>
        <Link href="/" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-rink-100 px-6 text-[15px] font-medium text-surface-100 hover:bg-rink-200">
          Back to Firstpass
        </Link>
      </main>
    </div>
  );
}
