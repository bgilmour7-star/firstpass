'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { noteAppOpen } from '@/app/site-actions';

// The installed app (decision 0021): registering the service worker, the "New version ready" notice,
// the install card and Account section, the offline note on Today, and clearing the saved copy on the
// sign-in screen.

const DISMISS_KEY = 'fp_install_dismissed';
const SNOOZE_DAYS = 30;
const TODAY_CACHE = 'fp-today';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

// Android and desktop Chrome fire beforeinstallprompt once, early; keep it for whichever card asks.
let deferred: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export type Device = 'standalone' | 'ios' | 'android-prompt' | 'android' | 'desktop';

/** What this browser can do about installing. Null until mounted (the server doesn't know). */
function useDevice(): Device | null {
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);
  const done = useSyncExternalStore(subscribe, () => installed, () => false);
  const [base, setBase] = useState<Device | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const ua = navigator.userAgent;
    if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) setBase('standalone');
    else if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) setBase('ios');
    else if (/android/i.test(ua)) setBase('android');
    else setBase('desktop');
  }, []);
  if (done) return 'standalone';
  if (base === 'android' || base === 'desktop') return prompt ? 'android-prompt' : base;
  return base;
}

/** Registers the worker and offers a new version when one is waiting. Lives in the app shell. */
export function AppWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [later, setLater] = useState(false);
  // Counts the coach as active today, and whether they came from the home screen (decision 0025).
  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const key = `fp_open_${installed ? 'app' : 'web'}`;
    const today = new Date().toLocaleDateString('en-CA');
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      // No storage: count anyway; the database keeps one row a day.
    }
    void noteAppOpen(installed);
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    let reg: ServiceWorkerRegistration | undefined;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener('updatefound', () => {
        const w = r.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w);
        });
      });
    };
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((r) => {
      reg = r;
      watch(r);
    }).catch(() => {});
    // Check for a new version whenever the app comes back to the front.
    const check = () => document.visibilityState === 'visible' && reg?.update().catch(() => {});
    document.addEventListener('visibilitychange', check);
    let reloading = false;
    const onChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => {
      document.removeEventListener('visibilitychange', check);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    };
  }, []);

  if (!waiting) return null;
  const reload = () => waiting.postMessage('reload');
  // Never reloads by itself: a coach mid-practice decides. "Later" folds the drawer into a small pill.
  if (later)
    return (
      <div role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full border border-border-100 bg-surface-100 py-1.5 pl-4 pr-1.5 text-sm shadow-[0_4px_12px_rgba(14,27,30,0.12)] lg:bottom-6 print:hidden">
        <span>New version ready</span>
        <button type="button" onClick={reload} className="min-h-10 rounded-full bg-rink-100 px-4 font-medium text-surface-100 hover:bg-rink-200">
          Reload
        </button>
      </div>
    );
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center print:hidden">
      <button type="button" aria-label="Later" onClick={() => setLater(true)} className="absolute inset-0 bg-ink-100/25" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        className="relative flex w-full max-w-md flex-col gap-4 rounded-t-[22px] bg-surface-100 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3 shadow-[0_-12px_32px_rgba(14,27,30,0.22)] lg:mb-6 lg:rounded-[22px]"
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border-100 lg:hidden" />
        <div className="flex items-start gap-3.5">
          <span aria-hidden="true" className="flex size-12 flex-none items-center justify-center rounded-[12px] bg-[#084F68]">
            <svg viewBox="0 0 48 48" width="28" height="28">
              <circle cx="9.5" cy="38.5" r="6.5" fill="#fff" />
              <path d="M17.5 33C21.5 30 24.5 27 27 23.5" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="4.4 3.8" strokeLinecap="round" />
              <path d="M31 18.5 23.06 22.62 27.47 23.35 29.53 27.32Z" fill="#fff" />
              <circle cx="37.5" cy="10.5" r="7.2" fill="none" stroke="#fff" strokeWidth="4" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="update-title" className="font-display text-[21px] font-bold leading-tight">
              A new version of Firstpass is ready
            </h2>
            <p className="text-[15px] text-ink-200">Reload to get it. Your plans are saved, so nothing is lost.</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={reload} className="min-h-12 rounded-full bg-rink-100 px-5 text-base font-semibold text-surface-100 hover:bg-rink-200">
            Reload now
          </button>
          <button type="button" onClick={() => setLater(true)} className="min-h-11 text-[15px] font-medium text-ink-200 hover:text-ink-100">
            Later
          </button>
        </div>
      </section>
    </div>
  );
}

/** Share icon as iOS draws it: a box with an arrow up. */
function ShareIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-3px]">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17" />
    </svg>
  );
}

function Steps({ device }: { device: Device }) {
  if (device === 'ios')
    return (
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          Tap Share <ShareIcon /> in the toolbar.
        </li>
        <li>
          Tap <b className="font-semibold">Add to Home Screen</b>, then <b className="font-semibold">Add</b>.
        </li>
        <li className="text-ink-200">The app asks you to sign in once. Use the 6-digit code from the email.</li>
      </ol>
    );
  if (device === 'android')
    return (
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Open your browser’s menu (⋮).</li>
        <li>
          Tap <b className="font-semibold">Install app</b> or <b className="font-semibold">Add to Home screen</b>.
        </li>
      </ol>
    );
  return null;
}

async function install(after: () => void) {
  if (!deferred) return;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  if (outcome === 'accepted') after();
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** The card on Today: phones only, not once installed, and "Not now" hides it for 30 days. */
export function InstallCard() {
  const device = useDevice();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(snoozed() || !window.matchMedia('(max-width: 1023px)').matches), []);
  if (hidden || !device || device === 'standalone' || device === 'desktop') return null;
  const notNow = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };
  return (
    <section aria-labelledby="install-title" className="flex gap-3.5 rounded-2xl border border-border-100 bg-surface-200 p-4">
      <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-[11px] bg-[#084F68]">
        <svg viewBox="0 0 48 48" width="26" height="26">
          <circle cx="9.5" cy="38.5" r="6.5" fill="#fff" />
          <path d="M17.5 33C21.5 30 24.5 27 27 23.5" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="4.4 3.8" strokeLinecap="round" />
          <path d="M31 18.5 23.06 22.62 27.47 23.35 29.53 27.32Z" fill="#fff" />
          <circle cx="37.5" cy="10.5" r="7.2" fill="none" stroke="#fff" strokeWidth="4" />
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h2 id="install-title" className="text-[16px] font-semibold leading-snug">
            Put Firstpass on your home screen
          </h2>
          <p className="text-sm text-ink-200">Today’s plan opens in one tap, even with no signal at the rink.</p>
        </div>
        <Steps device={device} />
        <div className="flex items-center gap-2">
          {device === 'android-prompt' && (
            <button type="button" onClick={() => install(() => setHidden(true))} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200">
              Install
            </button>
          )}
          <button type="button" onClick={notNow} className="min-h-11 px-3 text-sm font-medium text-ink-200 hover:text-ink-100">
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}

/** Account → Install on your phone: always there, for anyone who dismissed the card. */
export function InstallSection() {
  const device = useDevice();
  return (
    <section aria-labelledby="install-acct" className="flex flex-col gap-2 border-t border-border-100 pt-5">
      <h2 id="install-acct" className="text-[15px] font-semibold">
        Install on your phone
      </h2>
      {device === null ? null : device === 'standalone' ? (
        <p className="text-sm text-ink-200">You’re using the installed app. Today’s plan opens even with no signal.</p>
      ) : device === 'desktop' ? (
        <p className="text-sm text-ink-200">Open firstpass.coach on your phone and sign in, then come back here for the steps. Today’s plan then opens in one tap, even with no signal at the rink.</p>
      ) : (
        <>
          <p className="text-sm text-ink-200">Today’s plan opens in one tap, even with no signal at the rink.</p>
          <Steps device={device} />
          {device === 'android-prompt' && (
            <button type="button" onClick={() => install(() => {})} className="min-h-11 self-start rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200">
              Install
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** On Today with no signal: says this is the saved copy, and when it was saved. */
export function OfflineNote() {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if ('caches' in window)
      caches
        .open(TODAY_CACHE)
        .then((c) => c.match('/today'))
        .then((r) => r?.headers.get('x-fp-saved-at'))
        .then((at) => at && setSavedAt(new Date(at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' })))
        .catch(() => {});
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <p role="status" className="text-sm text-ink-200">
      Offline{savedAt ? ` · saved at ${savedAt}` : ''}
    </p>
  );
}

/** On the sign-in screen: whoever signed out, their saved plan leaves this phone. */
export function ClearSaved() {
  useEffect(() => {
    if ('caches' in window) caches.delete(TODAY_CACHE).catch(() => {});
  }, []);
  return null;
}
