'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { afterSignIn, JOIN_CODE, LAST_EMAIL, safeNext } from '@/lib/auth-after';

// Email-first sign-in (decision 0013). The screen asks for an email, then:
//   new       → create an account (first name + password), or "email me a link instead"
//   password  → password, or "email me a sign-in link"
//   link      → "email me a sign-in link"; after signing in, a password is offered once
// Every email Supabase sends carries a 6-digit code and a link, so it works when the email opens
// on another device or inside a mail app's own browser.

/** waitlist: no account, and no invite yet (sign-up is invite-only while the waitlist runs, decision 0019). */
export type Status = 'new' | 'password' | 'link' | 'waitlist';
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Ctx = { next?: string; joinCode?: string; teamName?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** A client with no session of its own: its emails carry a plain token hash, not a PKCE code tied to this browser. */
function stateless() {
  const e = env()!;
  return createClient(e.url, e.key, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false } });
}

async function confirmUrl(ctx: Ctx, nextOverride?: string) {
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const join = ctx.joinCode && JOIN_CODE.test(ctx.joinCode) ? `&join=${ctx.joinCode}` : '';
  // The email templates add &token_hash=…&type=… to this (scripts/email-templates.ts).
  return `${origin}/auth/confirm?next=${encodeURIComponent(safeNext(nextOverride ?? ctx.next))}${join}`;
}

const INVITE_ONLY = 'Firstpass is invite-only for now. Get early access at firstpass.coach and Brett will set you up.';

/** May this email create an account? With a working team join link, or once Brett has marked them Onboarded on the waitlist. */
async function invited(address: string, joinCode?: string): Promise<boolean> {
  if (joinCode && JOIN_CODE.test(joinCode)) {
    const { data } = await stateless().rpc('join_link_preview', { code: joinCode });
    if (((data as unknown[] | null) ?? []).length > 0) return true;
  }
  const { getSiteStore } = await import('@/lib/site/store');
  return (await getSiteStore()).canCreateAccount(address);
}

function clean(email: string): string | null {
  const a = email.trim().toLowerCase();
  return EMAIL.test(a) ? a : null;
}

async function remember(email: string) {
  // So "That link has expired" can offer a fresh one to the same address.
  (await cookies()).set(LAST_EMAIL, email, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 60, path: '/' });
}

function friendly(error: { status?: number; message: string; code?: string }, what: string): string {
  if (error.status === 429 || /rate limit|security purposes/i.test(error.message)) return 'Too many emails in a short time. Use the most recent one in your inbox, or try again in a minute.';
  console.error('[auth] %s failed: %s %s', what, error.status ?? '', error.code ?? error.message);
  return `Something went wrong. Try again in a minute.`;
}

/** Step 1: how does this email sign in? */
export async function checkEmail(email: string, joinCode?: string): Promise<Result<{ email: string; status: Status; firstName: string | null }>> {
  const address = clean(email);
  if (!address) return { ok: false, error: 'Enter your email, like you@example.com.' };
  if (!env()) return { ok: false, error: 'Sign-in is not configured.' };
  await remember(address);
  const { data, error } = await stateless().rpc('sign_in_status', { address });
  // Before the sign-in migration has run, everyone signs in with a link, as before.
  if (error) return { ok: true, email: address, status: 'link', firstName: null };
  const row = (data as { status: Status; first_name: string | null }[] | null)?.[0];
  const status = row?.status ?? 'new';
  if (status === 'new' && !(await invited(address, joinCode))) return { ok: true, email: address, status: 'waitlist', firstName: null };
  return { ok: true, email: address, status, firstName: row?.first_name ?? null };
}

/** New here: account with a password. Supabase emails a code to confirm the address. */
export async function createAccount(input: { email: string; firstName: string; password: string } & Ctx): Promise<Result> {
  const address = clean(input.email);
  const firstName = input.firstName.trim().slice(0, 40);
  if (!address) return { ok: false, error: 'Enter your email, like you@example.com.' };
  if (!firstName) return { ok: false, error: 'Add your first name. Your co-coaches see it.' };
  if (input.password.length < MIN_PASSWORD) return { ok: false, error: `Use ${MIN_PASSWORD} or more characters.` };
  if (!env()) return { ok: false, error: 'Sign-in is not configured.' };
  if (!(await invited(address, input.joinCode))) return { ok: false, error: INVITE_ONLY };
  const { data, error } = await stateless().auth.signUp({
    email: address,
    password: input.password,
    options: { emailRedirectTo: await confirmUrl(input, input.joinCode ? undefined : '/team/new'), data: { first_name: firstName, has_password: true, ...(input.teamName ? { join_team: input.teamName.slice(0, 80) } : {}) } },
  });
  if (error) {
    if (/password/i.test(error.message) && error.status === 422) return { ok: false, error: 'Pick a harder password: 8 or more characters, not a common one.' };
    return { ok: false, error: friendly(error, 'signUp') };
  }
  // Supabase answers "ok" for an address that already has an account, without sending anything.
  if (data.user && (data.user.identities ?? []).length === 0) return { ok: false, error: 'There’s already an account for this email. Go back and sign in.' };
  return { ok: true };
}

/** A code and link by email. Creates the account when it's new (with the first name, if given). */
export async function sendLink(input: { email: string; firstName?: string } & Ctx): Promise<Result> {
  const address = clean(input.email);
  if (!address) return { ok: false, error: 'Enter your email, like you@example.com.' };
  if (!env()) return { ok: false, error: 'Sign-in is not configured.' };
  const firstName = input.firstName?.trim().slice(0, 40);
  // Existing accounts always get their link; a new account only with an invite (decision 0019).
  const { data: known, error: unknown } = await stateless().rpc('sign_in_status', { address });
  const isNew = !unknown && ((known as { status: string }[] | null)?.[0]?.status ?? 'new') === 'new';
  if (isNew && !(await invited(address, input.joinCode))) return { ok: false, error: INVITE_ONLY };
  const { error } = await stateless().auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: isNew, emailRedirectTo: await confirmUrl(input), data: firstName ? { first_name: firstName, ...(input.teamName ? { join_team: input.teamName.slice(0, 80) } : {}) } : undefined },
  });
  if (error) return { ok: false, error: friendly(error, 'signInWithOtp') };
  return { ok: true };
}

/** The 6-digit code from the email, typed on the screen that asked for it. */
export async function verifyCode(input: { email: string; code: string } & Ctx): Promise<Result<{ to: string }>> {
  const address = clean(input.email);
  const token = input.code.replace(/\D/g, '');
  if (!address || token.length < 6) return { ok: false, error: 'Enter the code from the email.' };
  const { supabaseServer } = await import('@/lib/supabase/server');
  const db = await supabaseServer();
  let { data, error } = await db.auth.verifyOtp({ email: address, token, type: 'email' });
  if (error) ({ data, error } = await db.auth.verifyOtp({ email: address, token, type: 'signup' }));
  if (error) {
    if (error.status === 429) return { ok: false, error: friendly(error, 'verifyOtp') };
    return { ok: false, error: 'That code didn’t work. Check the newest email, or send a new code.' };
  }
  return { ok: true, to: await afterSignIn(data.session, { next: input.next, joinCode: input.joinCode }) };
}

export async function signInWithPassword(input: { email: string; password: string } & Ctx): Promise<Result<{ to: string }>> {
  const address = clean(input.email);
  if (!address || !input.password) return { ok: false, error: 'Enter your password.' };
  const { supabaseServer } = await import('@/lib/supabase/server');
  const db = await supabaseServer();
  const { data, error } = await db.auth.signInWithPassword({ email: address, password: input.password });
  if (error) {
    if (error.status === 429) return { ok: false, error: friendly(error, 'signInWithPassword') };
    if (/not confirmed/i.test(error.message)) return { ok: false, error: 'Confirm your email first: use the code we sent, or get a sign-in link below.' };
    return { ok: false, error: 'That password doesn’t match. Try again, or get a sign-in link below.' };
  }
  return { ok: true, to: await afterSignIn(data.session, { next: input.next, joinCode: input.joinCode, viaPassword: true }) };
}

/** Forgot it, or wants one: a link to set a password. */
export async function sendPasswordLink(email: string): Promise<Result> {
  const address = clean(email);
  if (!address) return { ok: false, error: 'Enter your email, like you@example.com.' };
  if (!env()) return { ok: false, error: 'Sign-in is not configured.' };
  const { error } = await stateless().auth.resetPasswordForEmail(address, { redirectTo: await confirmUrl({}, '/account/password') });
  if (error) return { ok: false, error: friendly(error, 'resetPasswordForEmail') };
  return { ok: true };
}
