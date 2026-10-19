# Setup

Production: https://firstpass.coach (`www.` redirects to it; DNS at Squarespace Domains; the old https://firstpass-jet.vercel.app still works). Vercel project `firstpass`; Supabase is connected through the Vercel Marketplace integration, which sets the env vars. Every push to `main` deploys.

## Once, in Supabase (open it from Vercel → Storage → the Supabase store → Open in Supabase)
1. **SQL editor →** paste and run `supabase/migrations/20261013000000_drill_review.sql` (tables, admin check, RLS).
2. **SQL editor →** paste and run `supabase/seed/drills.sql` (the drills in `content/drills`; regenerate with `npm run seed:sql`). It skips drills that are already there.
3. **Authentication → URL configuration:** Site URL = `https://firstpass.coach`. Redirect URLs: `https://firstpass.coach/**`, `https://firstpass-jet.vercel.app/**` and `http://localhost:3000/**`.
4. **Authentication → Emails → Templates** (decision 0013): run `npm run email:templates`, then paste each file into its template and set its subject:
   - **Magic Link:** `supabase/templates/magic-link.html`, subject `Your Firstpass code: {{ .Token }}`
   - **Confirm signup:** `supabase/templates/confirm-signup.html`, subject `Your Firstpass code: {{ .Token }}`
   - **Reset Password:** `supabase/templates/reset-password.html`, subject `Set your Firstpass password`
   - **Change Email Address:** `supabase/templates/change-email.html`, subject `Confirm your new Firstpass email` (decision 0014)

   Every button links to our `emailRedirectTo` (an `/auth/confirm?next=…` URL) plus the token hash, so it works in any browser or app, and every sign-in email also carries the 6-digit code.
   Then **Authentication → Sign In / Providers → Email:** Confirm email on, minimum password length 8, email OTP length 6, OTP expiry 3600 seconds.
5. **Authentication → Emails → SMTP Settings:** sign-in emails go out through Resend (free: 3,000 a month, 100 a day), with `firstpass.coach` verified there. Host `smtp.resend.com`, port `465`, username `resend`, password a Resend API key with sending access, sender email `hello@firstpass.coach`, sender name `Firstpass`. Then **Authentication → Rate Limits:** emails per hour 30.
6. **Check-in emails (decision 0010):** in Vercel, add the environment variable `RESEND_API_KEY` (a Resend key with sending access) and redeploy. Then run `supabase/migrations/20261021000000_checkin_emails.sql` in the SQL editor: it adds the email tables and starts a 10-minute timer that calls `https://firstpass.coach/api/cron/checkin-emails`. To stop the timer: `select cron.unschedule('firstpass-checkin-emails');`.
7. **Project settings → General:** check the region. Canada (Central) keeps data in Canada; if it isn't, that's fine for the pilot, but recreate the store in `ca-central-1` before real coaches sign up.

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

## Why Vercel builds start clean

`vercel.json` sets `installCommand: npm ci` and `buildCommand: rm -rf .next && next build`, so no Vercel build reuses cached `node_modules` or `.next`. On 2026-10-18, builds that reused the cache left the plan builder out of the client manifest, and every plan page failed ("Could not find the module …builder.tsx#Builder", digest 424264541). Every local and clean-clone build was fine. Turning off only webpack's cache didn't fix it; the fully clean build did. Builds take about a minute longer. Don't remove these settings without checking a plan page after the deploy.
