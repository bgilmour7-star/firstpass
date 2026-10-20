'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '@/app/auth/actions';
import { NAV_COOKIE } from '@/lib/nav';
import type { NavPractice } from '@/lib/nav-practice';

// The app's frame (design decision 2026-10-18, "Left navigation"): a left rail on desktop that is
// open by default, collapses to icons, peeks open on hover and is pinned with the button beside
// the logo or the [ key. Pages fill the space to its right. Phones get a slim top bar and the same
// navigation as a drawer. The rail's width is exposed as --rail-w so bars fixed to the bottom of
// the screen can start where the page starts.


type Props = {
  email: string;
  isAdmin: boolean;
  local: boolean;
  teamName?: string;
  next: NavPractice;
  reviewCount?: number;
  /** Shows Admin → Analytics (decision 0019). */
  analytics?: boolean;
  initialCollapsed: boolean;
  children: React.ReactNode;
};

export function AppShell({ email, isAdmin, local, teamName, next, reviewCount = 0, analytics = false, initialCollapsed, children }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [peek, setPeek] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const enter = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expanded = !collapsed || peek;

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${NAV_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
    setPeek(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) toggle();
      if (e.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => setDrawer(false), [path]);

  return (
    <div className={`min-h-dvh [--rail-w:0px] ${collapsed ? 'lg:[--rail-w:64px]' : 'lg:[--rail-w:248px]'}`}>
      {/* Desktop rail */}
      <aside
        aria-label="Firstpass"
        onMouseEnter={() => {
          if (!collapsed) return;
          clearTimeout(leave.current);
          enter.current = setTimeout(() => setPeek(true), 140); // a pause, so brushing past doesn't open it
        }}
        onMouseLeave={() => {
          clearTimeout(enter.current);
          leave.current = setTimeout(() => setPeek(false), 220);
        }}
        onFocus={() => collapsed && setPeek(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPeek(false);
        }}
        className={`fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-border-100 bg-surface-200 pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none lg:block print:hidden ${
          expanded ? 'w-[248px]' : 'w-16'
        } ${peek ? 'shadow-[0_12px_40px_rgba(14,27,30,0.18),0_2px_6px_rgba(14,27,30,0.08)]' : ''}`}
      >
        <Nav path={path} email={email} isAdmin={isAdmin} local={local} teamName={teamName} next={next} reviewCount={reviewCount} analytics={analytics} expanded={expanded} pin={{ collapsed, toggle }} />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex h-14 items-center gap-2 border-b border-border-100 bg-surface-100/95 px-2 backdrop-blur lg:hidden print:hidden">
        <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} className="grid size-11 place-items-center rounded-[10px] hover:bg-surface-200">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/plans" className="flex items-center gap-2 font-display text-[17px] font-bold">
          <Mark />
          Firstpass
        </Link>
        {teamName && <span className="ml-auto truncate pr-2 text-sm text-ink-200">{teamName}</span>}
      </header>

      {/* Phone drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-ink-100/40" />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface-200 pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] shadow-xl">
            <Nav path={path} email={email} isAdmin={isAdmin} local={local} teamName={teamName} next={next} reviewCount={reviewCount} analytics={analytics} expanded />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pb-24 pt-6 transition-[margin] duration-200 ease-out motion-reduce:transition-none lg:ml-[var(--rail-w)] lg:px-8 print:ml-0 print:px-0">
        {children}
      </main>
    </div>
  );
}

function Nav({
  path,
  email,
  isAdmin,
  local,
  teamName,
  next,
  reviewCount,
  analytics,
  expanded,
  pin,
}: {
  path: string;
  email: string;
  isAdmin: boolean;
  local: boolean;
  teamName?: string;
  next: NavPractice;
  reviewCount: number;
  analytics: boolean;
  expanded: boolean;
  pin?: { collapsed: boolean; toggle: () => void };
}) {
  const [menu, setMenu] = useState(false);
  const acct = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !acct.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);
  useEffect(() => setMenu(false), [path]);

  const items = [
    { href: '/today', label: next.label, sub: next.sub, icon: <CalendarDay day={next.day} /> },
    { href: '/plans', label: 'Plans', icon: <Icon d="M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 4V3h6v1M9 10h6M9 14h6M9 18h3" /> },
    { href: '/drills', label: 'Drills', icon: <RinkIcon /> },
    { href: '/team', label: 'Team', icon: <Icon d="M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4M17 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16.5 14.4c2.4.2 4 1.8 4.5 4.6" /> },
  ];
  const fade = `transition-opacity duration-150 motion-reduce:transition-none ${expanded ? 'opacity-100' : 'opacity-0'}`;
  const row = 'relative grid h-11 grid-cols-[24px_minmax(0,1fr)] items-center gap-3 whitespace-nowrap rounded-[10px] px-[10px] text-[15px]';
  const link = (href: string, label: string, icon: React.ReactNode, sub?: string, badge = 0) => {
    const on = path === href || path.startsWith(href + '/');
    return (
      <Link key={href} href={href} aria-current={on ? 'page' : undefined} aria-label={expanded ? (badge ? `${label}, ${badge} waiting` : undefined) : sub ? `${label}, ${sub}` : badge ? `${label}, ${badge} waiting` : label} className={`${row} ${sub ? 'h-[52px]' : ''} ${on ? 'bg-ink-100 text-surface-100' : 'text-ink-100 hover:bg-surface-300'}`}>
        <span className="relative grid size-6 place-items-center">
          {icon}
          {badge > 0 && !expanded && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface-200 bg-whistle-100" />}
        </span>
        {badge > 0 ? (
          <span className={`flex min-w-0 items-center justify-between gap-2 ${fade}`}>
            <span className="truncate">{label}</span>
            <span aria-hidden="true" className="rounded-full bg-whistle-100 px-2 py-px font-mono text-xs font-medium text-surface-100">
              {badge}
            </span>
          </span>
        ) : sub ? (
          <span className={`flex min-w-0 flex-col ${fade}`}>
            <span className="truncate leading-5">{label}</span>
            <span className={`truncate text-xs leading-4 ${on ? 'text-surface-100/75' : 'text-ink-200'}`}>{sub}</span>
          </span>
        ) : (
          <span className={`truncate ${fade}`}>{label}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full w-[248px] max-w-full flex-col gap-1 px-[10px] py-3">
      <div className="flex h-11 items-center gap-3 pl-[10px]">
        <Link href="/plans" className="flex min-w-0 items-center gap-3 font-display text-lg font-bold" aria-label="Firstpass home">
          <Mark />
          <span className={fade}>Firstpass</span>
        </Link>
        {pin && (
          <button
            type="button"
            onClick={pin.toggle}
            aria-pressed={!pin.collapsed}
            aria-label={pin.collapsed ? 'Keep the menu open' : 'Collapse the menu'}
            title={`${pin.collapsed ? 'Keep the menu open' : 'Collapse the menu'} ( [ )`}
            tabIndex={expanded ? 0 : -1}
            className={`ml-auto grid size-10 place-items-center rounded-[10px] text-ink-200 hover:bg-surface-300 hover:text-ink-100 ${fade} ${expanded ? '' : 'pointer-events-none'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d={pin.collapsed ? 'M9 4v16M13.5 10l2 2-2 2' : 'M9 4v16M16 10l-2 2 2 2'} />
            </svg>
          </button>
        )}
      </div>

      {teamName && (
        <Link href="/team" className="mb-3 mt-1 grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-[10px] px-[10px] py-2 hover:bg-surface-300" aria-label={expanded ? undefined : `Team: ${teamName}`}>
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-rink-100 font-display text-[11px] font-bold text-surface-100">
            {initials(teamName)}
          </span>
          <span className={`truncate text-sm font-medium ${fade}`}>{teamName}</span>
        </Link>
      )}

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {items.map((i) => link(i.href, i.label, i.icon, 'sub' in i ? i.sub : undefined))}
        {isAdmin && (
          <>
            <div aria-hidden="true" className="mx-[10px] my-2.5 h-px bg-border-100" />
            {link('/admin/drills', 'Drill review', <Icon d="M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 4V3h6v1M9 13l2 2 4-4.5" />, undefined, reviewCount)}
            {analytics && link('/admin/analytics', 'Analytics', <Icon d="M4 20h16M6 16l4-5 3 3 5-7" />)}
          </>
        )}
      </nav>

      <div className="flex-1" />

      <div ref={acct} className="relative">
        {local ? (
          <div className={`${row} text-ink-200`}>
            <Avatar email={email} />
            <span className={`truncate text-sm ${fade}`} title="Local mode: data lives in content/drills and .local/">
              {email} · local mode
            </span>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="true" aria-label={`Account: ${email}`} className={`${row} h-13 w-full text-left hover:bg-surface-300`}>
              <Avatar email={email} />
              <span className={`truncate text-sm ${fade}`}>{email}</span>
            </button>
            {menu && (
              <div className="absolute bottom-full left-0 z-40 mb-1 w-[228px] rounded-[10px] border border-border-100 bg-surface-100 p-1 shadow-lg">
                <p className="truncate px-3 pb-1.5 pt-2 text-xs text-ink-200">Signed in as {email}</p>
                <Link href="/account" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-200">
                  Account
                </Link>
                <form action={signOut}>
                  <button type="submit" className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-200">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Avatar({ email }: { email: string }) {
  return (
    <span aria-hidden="true" className="grid size-[26px] place-items-center rounded-full bg-ink-100 font-display text-xs font-bold text-surface-100">
      {email.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function initials(name: string) {
  const words = name.replace(/\b(U\d+|Nanaimo)\b/gi, '').trim().split(/\s+/).filter(Boolean);
  const pick = words.length ? words : name.split(/\s+/);
  return (pick.length === 1 ? pick[0].slice(0, 2) : pick[0][0] + pick[1][0]).toUpperCase();
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Today / Next practice: a calendar page showing that practice's day of the month. */
function CalendarDay({ day }: { day: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9h17M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <text x="12" y="17.6" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="var(--font-display)">
        {day}
      </text>
    </svg>
  );
}

/** Drills: a small rink with its centre line and blue lines. */
function RinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="6.5" />
      <path d="M12 5.5v13" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M7.5 5.5v13M16.5 5.5v13" strokeDasharray="1.5 2" />
    </svg>
  );
}

// "Puck to teammate": a puck, a dashed pass and a teammate ring, in one colour.
export function Mark() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" className="shrink-0 text-rink-200">
      <ellipse cx="4" cy="12" rx="3.2" ry="2" fill="currentColor" />
      <path d="M8 11 L17 7" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2.4 2" fill="none" />
      <circle cx="21" cy="6" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}
