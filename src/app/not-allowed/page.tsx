export default function NotAllowed() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-2 px-4">
      <h1 className="text-2xl font-bold">Admins only</h1>
      <p className="text-sm text-ink-200">You&apos;re signed in, but this account can&apos;t review drills. Ask Brett to add you as an admin.</p>
    </main>
  );
}
