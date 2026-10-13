import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      {admin.local && (
        <p className="bg-surface-300 px-4 py-2 text-center text-xs text-ink-100">
          Local mode: drills are read from and saved to <code className="font-mono">content/drills</code>. Connect Supabase to share reviews.
        </p>
      )}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-border-100 bg-surface-100/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/admin/drills" className="flex items-center gap-2 font-display text-lg font-bold">
            <Mark />
            Firstpass
          </Link>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-surface-100">Admin</span>
          <span className="ml-auto truncate text-sm text-ink-200">{admin.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}

// "Puck to teammate": a puck, a dashed pass and a teammate ring, in one colour.
function Mark() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" className="text-rink-200">
      <ellipse cx="4" cy="12" rx="3.2" ry="2" fill="currentColor" />
      <path d="M8 11 L17 7" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2.4 2" fill="none" />
      <circle cx="21" cy="6" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}
