'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// One header for coach and admin screens. Desktop nav per the navigation map: Plans · Drills · Team,
// plus Drill review for admins. On phones the same links sit in a row under the logo.

export function AppHeader({ email, isAdmin, local, teamName }: { email: string; isAdmin: boolean; local: boolean; teamName?: string }) {
  const path = usePathname();
  const items = [
    { href: '/plans', label: 'Plans' },
    { href: '/drills', label: 'Drills' },
    { href: '/team', label: 'Team' },
    ...(isAdmin ? [{ href: '/admin/drills', label: 'Drill review' }] : []),
  ];
  const nav = (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
      {items.map((i) => {
        const on = path === i.href || path.startsWith(i.href + '/');
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? 'page' : undefined}
            className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-sm ${on ? 'bg-ink-100 text-surface-100' : 'text-ink-100 hover:bg-surface-200'}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      {local && (
        <p className="bg-surface-300 px-4 py-2 text-center text-xs text-ink-100">
          Local mode: data lives in <code className="font-mono">content/drills</code> and <code className="font-mono">.local/</code>. Connect Supabase to share it.
        </p>
      )}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-border-100 bg-surface-100/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/plans" className="flex items-center gap-2 font-display text-lg font-bold">
            <Mark />
            Firstpass
          </Link>
          {teamName && <span className="hidden truncate text-sm text-ink-200 sm:inline">{teamName}</span>}
          <div className="ml-4 hidden md:block">{nav}</div>
          <span className="ml-auto truncate text-sm text-ink-200">{email}</span>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2 md:hidden">{nav}</div>
      </header>
    </>
  );
}

// "Puck to teammate": a puck, a dashed pass and a teammate ring, in one colour.
export function Mark() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" className="text-rink-200">
      <ellipse cx="4" cy="12" rx="3.2" ry="2" fill="currentColor" />
      <path d="M8 11 L17 7" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2.4 2" fill="none" />
      <circle cx="21" cy="6" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}
