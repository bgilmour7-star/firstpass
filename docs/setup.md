# Setup

Production: https://firstpass-bgilmour7-5571s-projects.vercel.app (Vercel project `firstpass`, Supabase connected through the Vercel Marketplace integration, which sets the env vars). Every push to `main` deploys.

## Once, in Supabase (open it from Vercel → Storage → the Supabase store → Open in Supabase)
1. **SQL editor →** paste and run `supabase/migrations/20261013000000_drill_review.sql` (tables, admin check, RLS).
2. **SQL editor →** paste and run `supabase/seed/drills.sql` (the drills in `content/drills`; regenerate with `npm run seed:sql`). It skips drills that are already there.
3. **Authentication → URL configuration:** Site URL = the production URL above. Redirect URLs: `https://firstpass-bgilmour7-5571s-projects.vercel.app/**` and `http://localhost:3000/**`.
4. **Project settings → General:** check the region. Canada (Central) keeps data in Canada; if it isn't, that's fine for the pilot, but recreate the store in `ca-central-1` before real coaches sign up.

## Make yourself an admin
1. Open the production URL, enter your email, click the link in the email.
2. You'll land on "Admins only". In the SQL editor:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'brett@paddio.ca';
   ```
3. Reload. Repeat for the head coach after they've signed in once.

## If the site asks for a Vercel login
Vercel → Project → Settings → Deployment Protection → set Vercel Authentication to preview deployments only (or off). The app has its own sign-in; the head coach shouldn't need a Vercel account.

## Let Claude work diagram requests
Claude's cloud sessions can't reach Supabase by default. Add your Supabase host (`<ref>.supabase.co`) to the Claude environment's allowed domains and add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment secrets. Until then, paste open requests into the chat.

## Local development
`npm install && npm run dev`, open http://localhost:3000. Without Supabase variables the app runs in local mode on `content/drills/*.json` with no sign-in. To use the real database locally, `vercel env pull .env.local`.

## Costs (checked 2026-10-13)
- Supabase Free: $0. Pauses after a week with no activity; un-pause from its dashboard. Pro is $25 USD/month when real coaches use it.
- Vercel Hobby: $0, terms are personal, non-commercial. Fine while it's admins reviewing drills; move to Pro ($20 USD/month) before any outside team signs in.
