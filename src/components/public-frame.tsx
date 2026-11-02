import Link from 'next/link';
import { Mark } from '@/components/landing/mark';

// The plain frame for public pages reached from an email (the survey, unsubscribe): the mark, one
// narrow column, phone first. No nav: these people may not have an account.
export function PublicFrame({ children, back, progress }: { children: React.ReactNode; back?: React.ReactNode; progress?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-100 text-ink-100">
      <header className="mx-auto grid h-14 w-full max-w-[520px] grid-cols-[44px_1fr_44px] items-center px-1">
        <span>{back}</span>
        <Link href="/" className="inline-flex items-center justify-center gap-1.5 justify-self-center text-rink-200" aria-label="Firstpass home">
          <Mark className="size-[22px]" />
          <b className="font-display text-[15px] font-bold leading-none text-ink-100">Firstpass</b>
        </Link>
        <span className="pr-2 text-right text-[13px] text-ink-200">{progress}</span>
      </header>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col">{children}</main>
    </div>
  );
}
