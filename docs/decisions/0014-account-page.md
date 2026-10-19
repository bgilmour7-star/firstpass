# Decision: An Account page for name, email and password
Status: Accepted · 2026-10-19 (Brett: "can we create a profile for the user where they can see their email, change their name, etc?")

## Context
First names are asked for at sign-up (decision 0013), so coaches who signed up before then, or who typed a nickname, had no way to set or change theirs. Email and password had no home either: Password sat alone in the account menu.

## Decision
- **Account menu → Account (`/account`)**, inside the app frame: first name (saved to auth metadata, used everywhere a coach is named), sign-in email, password (set or change), team and role with a link to Team settings, sign out.
- **Changing email** uses Supabase's secure email change: a link goes to both the old and new address, and the email changes once both are confirmed. The page says which step you're on. Branded template: `supabase/templates/change-email.html`.
- **No name yet?** The Coaches list shows "Add your name" next to "(you)".
- Names saved before a change stay on old edit-log lines and check-ins; new ones use the new name.
