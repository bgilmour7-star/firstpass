import type { Metadata } from 'next';
import Link from 'next/link';
import { Mark } from '@/components/landing/mark';

export const metadata: Metadata = {
  title: 'Privacy · Firstpass',
  description: 'What Firstpass collects, why, and how to have it removed.',
  robots: { index: true, follow: true },
};

// Plain words, short (decision 0019). Update the date when anything here changes.
export default function Privacy() {
  const h2 = 'mt-10 font-display text-[22px] font-bold leading-tight';
  const p = 'mt-3 text-[17px] leading-[1.6] text-ink-100';
  const li = 'mt-2 text-[17px] leading-[1.6]';
  return (
    <div className="min-h-dvh bg-surface-100 text-ink-100">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-[clamp(16px,4vw,48px)] py-5">
        <Link href="/" aria-label="Firstpass home" className="inline-flex items-center gap-2.5">
          <Mark className="size-[30px]" />
          <span className="font-display text-2xl font-extrabold leading-none tracking-[-0.01em]">Firstpass</span>
        </Link>
      </header>
      <main className="mx-auto max-w-[680px] px-[clamp(16px,4vw,48px)] pb-24 pt-8">
        <h1 className="font-display text-[clamp(40px,6vw,56px)] font-extrabold leading-[1] tracking-[-0.03em]">Privacy</h1>
        <p className="mt-3 text-sm text-ink-200">Last updated October 29, 2026</p>
        <p className={p}>Firstpass is a practice planner for volunteer hockey coaches, run by Brett in Nanaimo, BC. This page says what we collect, why, and how to have it removed.</p>

        <h2 className={h2}>No kids’ information, ever</h2>
        <p className={p}>Firstpass never stores children’s names, photos or birthdates. Teams are described by skill group and counts only.</p>

        <h2 className={h2}>If you join the waitlist</h2>
        <p className={p}>We keep what you type in the form:</p>
        <ul className="mt-1 list-disc pl-6">
          <li className={li}>your email</li>
          <li className={li}>whether you coach a team or run an association</li>
          <li className={li}>your age group, team or association name, and number of teams, if you gave them</li>
          <li className={li}>the link that brought you, if it had a tag (like a shared plan)</li>
        </ul>
        <p className={p}>We use it to email you about Firstpass and to set up a call. Only Brett sees the list. We don’t sell it or share it with anyone.</p>

        <h2 className={h2}>If you answer the survey or talk with Brett</h2>
        <p className={p}>
          We may email you a short survey about how you plan practices, to decide what to build. We keep your answers, and if you’d like a call, the times that suit you and your phone number if you give one. Brett keeps notes from calls and chats, and only he sees them. A copy filed under a code, with your first name and team but never your email or phone number, is kept with Firstpass’s code so we can look across everyone’s answers. Your data stays in Canada. Every survey email has a link to stop them, and asking us to delete your information removes your answers and notes too.
        </p>

        <h2 className={h2}>When you visit this site</h2>
        <p className={p}>We count visits without cookies. For each visit we keep the page, the time, the type of device (phone, tablet or computer), the city and province your connection appears to come from, and the site or link that sent you.</p>
        <p className={p}>To tell visitors apart within a day, we scramble your internet address and browser together with a code that changes every day. We don’t keep your internet address, and yesterday’s code is deleted, so the scrambled value can’t be traced back to you or followed from one day to the next.</p>

        <h2 className={h2}>If you coach with Firstpass</h2>
        <p className={p}>Signing in uses a cookie to keep you signed in. Your team’s plans, check-ins and the coaches on your team are visible to the coaches on that team. Parent links show a plan without signing in.</p>

        <h2 className={h2}>Where it’s kept</h2>
        <p className={p}>Data is stored with Supabase, our database provider. Emails are sent with Resend. The site runs on Vercel.</p>

        <h2 className={h2}>Removing your information</h2>
        <p className={p}>
          Email <a href="mailto:hello@firstpass.coach" className="font-medium text-rink-100 underline">hello@firstpass.coach</a> and we’ll take you off the waitlist, or delete your account and what’s attached to it.
        </p>
      </main>
      <footer className="border-t border-border-100">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-[clamp(16px,4vw,48px)] py-7 text-sm text-ink-200">
          <span>Firstpass · Built in Nanaimo, BC</span>
          <Link href="/" className="py-2.5 hover:underline">
            Back to firstpass.coach
          </Link>
        </div>
      </footer>
    </div>
  );
}
