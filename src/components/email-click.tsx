'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordEmailClick } from '@/app/email-click-action';
import { EMAIL_REF } from '@/lib/broadcasts/ref';

// Email link attribution (decision 0036), for the case the middleware can't count: a coach who opens an update
// email link signed out, on a page that doesn't need sign-in (the home page, say). It takes only an email tag off the
// address bar (other ?from= values, like share and invite links, belong to the visit tracker and stay), keeps it in
// this tab, and tries again on each page change until the coach is signed in. Signed-in clicks are counted by the
// middleware before the page loads. No cookies. Never throws: a failure just means a click isn't counted.

const KEY = 'fp-email-from';

export function EmailClick() {
  const pathname = usePathname();
  useEffect(() => {
    let from: string | null = null;
    try {
      const url = new URL(window.location.href);
      const tag = url.searchParams.get('from');
      if (tag && EMAIL_REF.test(tag)) {
        from = tag;
        sessionStorage.setItem(KEY, tag);
        url.searchParams.delete('from');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      } else {
        from = sessionStorage.getItem(KEY);
      }
    } catch {
      return;
    }
    if (!from || !EMAIL_REF.test(from)) return;
    recordEmailClick(from)
      .then((r) => {
        if (r !== 'signed-out') sessionStorage.removeItem(KEY);
      })
      .catch(() => {});
  }, [pathname]);
  return null;
}
