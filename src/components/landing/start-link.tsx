'use client';

import Link from 'next/link';
import { track } from '@/app/site-actions';
import { visitSource } from './visit-tracker';

// "Plan your first practice" (decision 0033): sign-up is open, so every call to action on the page
// goes to /signup, where a new coach creates an account (Google or email) and lands on team
// setup. A tap is counted as form_start, the funnel's "Tapped Plan your first practice".
export function StartLink({ id, className, children = 'Plan your first practice', tabIndex, hidden }: { id?: string; className: string; children?: React.ReactNode; tabIndex?: number; hidden?: boolean }) {
  return (
    <Link id={id} href="/signup" aria-hidden={hidden} tabIndex={tabIndex} onClick={() => void track('form_start', location.pathname, visitSource())} className={className}>
      {children}
    </Link>
  );
}
