import { LoginForm } from './form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Sign in to Firstpass</h1>
        <p className="text-sm text-ink-200">We&apos;ll email you a link. No password.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-flag-100">
          That link didn&apos;t work. Links work once and expire after an hour. Ask for a new one.
        </p>
      )}
      <LoginForm next={next?.startsWith('/') ? next : '/admin/drills'} />
    </main>
  );
}
