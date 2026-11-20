import Link from 'next/link';
import { Mark } from '@/components/landing/mark';
import { StartLink } from '@/components/landing/start-link';
import { VisitTracker } from '@/components/landing/visit-tracker';
import { jsonLd } from '@/lib/site/structured-data';

// The frame for the answer pages and hubs (decision 0038): the logo, one reading column, a footer
// that links back to the hub. Phone first. Visits count the same way as the landing page (no
// cookies), and the page's path goes with each event.

export const prose = {
  h2: 'mt-12 font-display text-[clamp(24px,3vw,30px)] font-bold leading-tight tracking-[-0.015em]',
  p: 'mt-4 text-[17px] leading-[1.65] text-ink-100',
  ul: 'mt-4 flex list-disc flex-col gap-2 pl-6 text-[17px] leading-[1.6]',
};

const ctaShape = 'inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-[17px] font-medium';
export const cta = `${ctaShape} bg-rink-100 text-surface-100 hover:bg-rink-200`;
/** On the dark teal band. */
export const ctaOnTeal = `${ctaShape} bg-surface-100 text-ink-100 hover:bg-surface-200`;

export function ContentFrame({ data, children }: { data: unknown; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-100 text-ink-100">
      <VisitTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-4 sm:px-[clamp(16px,4vw,48px)]">
        <Link href="/" aria-label="Firstpass home" className="inline-flex items-center gap-2.5">
          <Mark className="size-[26px]" />
          <span className="font-display text-[20px] sm:text-[22px] font-extrabold leading-none tracking-[-0.01em]">Firstpass</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/login" className="hidden min-h-11 items-center px-3.5 text-[15px] font-medium hover:underline sm:inline-flex">
            Sign in
          </Link>
          <StartLink className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-rink-100 px-3.5 text-[14px] font-medium text-surface-100 hover:bg-rink-200 sm:px-4 sm:text-[15px]" />
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-5 pb-20 pt-6 sm:px-[clamp(16px,4vw,48px)]">{children}</main>
      <footer className="border-t border-border-100">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-7 text-sm text-ink-200 sm:px-[clamp(16px,4vw,48px)]">
          <span className="inline-flex items-center gap-2 text-ink-100">
            <Mark className="size-5" />
            <span className="font-display text-[17px] font-extrabold">Firstpass</span>
            <span className="ml-2 text-sm text-ink-200">Hockey practice planner, built in Nanaimo, BC</span>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/u7" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
              U7 practice help
            </Link>
            <Link href="/associations" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
              Associations
            </Link>
            <a href="mailto:hello@firstpass.coach" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
              hello@firstpass.coach
            </a>
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
