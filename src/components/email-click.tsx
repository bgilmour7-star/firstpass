'use client';

import { useEffect } from 'react';
import { recordEmailClick } from '@/app/email-click-action';
import { EMAIL_REF } from '@/lib/broadcasts/ref';

// Email link attribution (decision 0036). An update email's firstpass.coach links carry ?from=<ref>-<n>. On any page,
// this takes the tag off the address bar (so a shared or bookmarked link doesn't count again) and records it for the
// signed-in coach. Signed out, it keeps the tag in this tab until they've signed in. No cookies.

const KEY = 'fp-email-from';

export function EmailClick() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('from');
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(KEY);
    } catch {}
    const from = fromUrl && EMAIL_REF.test(fromUrl) ? fromUrl : pending;
    if (fromUrl) {
      url.searchParams.delete('from');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (!from || !EMAIL_REF.test(from)) return;
    recordEmailClick(from).then((r) => {
      try {
        if (r === 'signed-out') sessionStorage.setItem(KEY, from);
        else sessionStorage.removeItem(KEY);
      } catch {}
    });
  }, []);
  return null;
}
