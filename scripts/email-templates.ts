// Writes the Supabase Auth email templates (supabase/templates/*.html) from the same branded frame
// the app's own emails use (src/lib/email/layout.ts). Run `npm run email:templates`, then paste each
// file into Supabase → Authentication → Emails → Templates with the subject shown (docs/setup.md).
//
// Every link is our emailRedirectTo (an /auth/confirm URL that already carries ?next=… and, from a
// join link, &join=…) plus the one-time token, so it works in any browser or app (decision 0013).
// Every sign-in email also carries the 6-digit code, for when the email opens on another device.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPABASE_TEMPLATES } from '../src/lib/email/supabase-templates';

const out = join(process.cwd(), 'supabase', 'templates');
mkdirSync(out, { recursive: true });

for (const [name, t] of Object.entries(SUPABASE_TEMPLATES)) {
  writeFileSync(join(out, `${name}.html`), t.html);
  console.log(`supabase/templates/${name}.html  ·  subject: ${t.subject}`);
}
