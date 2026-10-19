import { requireUser } from '@/lib/auth';
import { safeNext } from '@/lib/auth-after';
import { AuthFrame } from '@/components/auth-frame';
import { PasswordForm } from './form';

export const dynamic = 'force-dynamic';

// Three ways in (decision 0013): the one-time offer after signing in with a link (?offer=1),
// the "Set password" button in a password email, and "Password" in the account menu.
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ offer?: string; next?: string }> }) {
  const coach = await requireUser('/account/password');
  const { offer, next } = await searchParams;
  const mode = offer ? 'offer' : coach.hasPassword ? 'change' : 'set';
  return (
    <AuthFrame panel={false}>
      <PasswordForm mode={mode} email={coach.email} next={safeNext(next)} />
    </AuthFrame>
  );
}
