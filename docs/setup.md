# Setup

About 20 minutes, once. After this, every push to `main` deploys.

## 1. Supabase (database and sign-in)
1. Create a project at supabase.com. **Region: Canada (Central), `ca-central-1`**, so coach data stays in Canada. Free plan is fine for the pilot.
2. SQL editor → paste and run `supabase/migrations/20261013000000_drill_review.sql`.
3. Authentication → URL configuration: set **Site URL** to your Vercel URL (step 2), and add `http://localhost:3000/**` and `https://<your-vercel-domain>/**` to **Redirect URLs**.
4. Project settings → API: copy the **Project URL**, the **anon public** key and the **service_role** key.

## 2. Vercel (hosting)
1. New project → import `bgilmour7-star/firstpass`. Framework: Next.js (detected).
2. Environment variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - Don't add the service_role key to Vercel; the app doesn't need it.
3. Deploy.

## 3. Make yourself an admin
1. Open the deployed site, sign in with your email (magic link).
2. Supabase SQL editor:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email in ('brett@paddio.ca');
   ```
   Repeat for the head coach after they sign in once.

## 4. Load the drills
On your machine (or in a Claude session that can reach Supabase), create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
Then `npm install && npm run drills -- seed`.

## 5. Let Claude work diagram requests
Claude's cloud sessions can't reach Supabase by default (network allowlist). Either add your project host (`<ref>.supabase.co`) to the Claude environment's allowed domains and give it the three variables above as environment secrets, or run `npm run drills -- requests` yourself and paste the output into the chat.

## Local development
`npm install && npm run dev`, open http://localhost:3000. Without the Supabase variables the app runs in local mode on `content/drills/*.json` with no sign-in.

## Costs (checked 2026-10-13)
- Supabase Free: $0. Pauses after 1 week with no activity; un-pause from the dashboard. Pro is $25 USD/month when real coaches use it.
- Vercel Hobby: $0, but its terms are personal, non-commercial use. Fine while it's you and the head coach reviewing drills; move to Pro ($20 USD/month) before any outside team signs in.
