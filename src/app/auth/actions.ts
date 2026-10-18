'use server';

import { redirect } from 'next/navigation';

// Ends the session on this device and goes back to the sign-in screen.
export async function signOut() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const supabase = await supabaseServer();
    await supabase.auth.signOut({ scope: 'local' });
  }
  redirect('/login');
}
