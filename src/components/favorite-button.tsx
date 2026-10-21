'use client';

import { useState, useTransition } from 'react';
import type { Favorite } from '@/lib/app/store';
import { setTeamFavorite } from '@/app/(coach)/drills/actions';

// A team favourite (decision 0012): any coach can star a drill for the whole team. A star, not a
// heart: the heart already means "Kids loved it" from check-ins.

const when = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Vancouver' });
export const starredBy = (f: Favorite) => `Starred by ${f.by || 'a coach'}${f.at ? ` · ${when(f.at)}` : ''}`;

export function StarIcon({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8L12 3.2Z" />
    </svg>
  );
}

export function FavoriteButton({
  drillId,
  drillName,
  initial,
  variant = 'icon',
  onChange,
}: {
  drillId: string;
  drillName: string;
  initial: Favorite | null;
  variant?: 'icon' | 'full' | 'tile';
  onChange?: (fav: Favorite | null) => void;
}) {
  const [fav, setFav] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const on = Boolean(fav);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const before = fav;
    const next = on ? null : { by: 'You', at: new Date().toISOString() };
    setFav(next);
    onChange?.(next);
    setError(null);
    start(async () => {
      const r = await setTeamFavorite(drillId, !on);
      if (!r.ok) {
        setFav(before);
        onChange?.(before);
        setError(r.error);
      } else {
        setFav(r.fav);
        onChange?.(r.fav);
      }
    });
  };
  const label = on ? `Remove ${drillName} from team favourites` : `Star ${drillName} for the team`;

  if (variant === 'full') {
    return (
      <span className="flex flex-col gap-1">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={on}
          className={`inline-flex min-h-10 w-fit items-center gap-2 rounded-full border px-4 text-sm font-medium disabled:opacity-60 ${on ? 'border-rink-100 text-rink-100' : 'border-border-100 hover:bg-surface-200'}`}
        >
          <StarIcon on={on} size={18} />
          {on ? 'Team favourite' : 'Star for the team'}
        </button>
        <span className="text-xs text-ink-200" aria-live="polite">
          {error ? <span className="text-flag-100">{error}</span> : fav ? starredBy(fav) : 'Shows first for every coach on the team.'}
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      title={error ?? (fav ? starredBy(fav) : 'Star for the team')}
      className={`grid shrink-0 place-items-center disabled:opacity-60 ${variant === 'tile' ? `size-[42px] rounded-xl border bg-surface-100 ${on ? 'border-rink-100' : 'border-border-100'}` : 'size-10 rounded-full'} ${on ? 'text-rink-100' : 'text-ink-200 hover:text-ink-100'} ${error ? 'ring-2 ring-flag-100' : ''}`}
    >
      <StarIcon on={on} />
    </button>
  );
}
