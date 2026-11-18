# 0035 · Emails to coaches from Admin → Send

Date: 2026-11-18 · Decided by: Brett ("I'd like to be able to send out emails to all or segments of the coaches without
having to do it manually through my gmail account… It will need to be able to support text and images on our template.")

## Decision
- **Built into Admin, not Resend Broadcasts.** A Send tab (`/admin/send`, Brett only) lists emails; each opens an
  editor with the email in the Firstpass template beside it. Brett chose this over syncing contacts to Resend.
- **Blocks, not Markdown.** Text (blank line = paragraph; `**bold**` and `[link](https://…)`), heading, image, button.
  Links are https only; everything else is escaped. Greeting "Hi <first name>," is on by default. From "Brett at
  Firstpass", reply-to hello@.
- **Segments from live app data** (`broadcast_recipients`): all coaches, head coaches, by age group (team's), and
  signed up but stalled (3+ days and never ran a practice, or nothing done for 14 days). Always leaves out admins,
  unconfirmed or deleted accounts, anyone who stopped update emails, and anyone who unsubscribed from survey emails
  (the old waitlist unsubscribe promised no more emails at all).
- **Its own opt-out.** `research_people.updates_off_at`, from `/unsubscribe/<token>/updates` (a button, so link
  scanners can't trigger it) and a `List-Unsubscribe` header. Survey and practice emails aren't affected. The privacy
  page says so.
- **Sending**: Brett confirms the count. `start_broadcast` works the list out again, and in one transaction either
  refuses (the count changed; the new count shows) or writes one `broadcast_sends` row per person and marks it sending.
  Anyone who opts out after that is skipped, never sent. Then Resend batches of 100, each with its own greeting and
  opt-out, idempotency key per batch. A send that stops (45-second budget, rate limit, Resend down) leaves the rest
  queued for "Carry on sending" (a 409 from Resend counts as in progress, not failed); nobody gets it twice.
- **Image descriptions are never filled from the file name**, which could hold a child's name.
- **Images** upload to a public Supabase Storage bucket in Canada (`email-images`, 2 MB, PNG/JPG/GIF/WebP), Brett only.
  The editor says never a photo of a child.

## Not done
- Scheduling a send for later, open counts (Resend open tracking is off), click and activity counts (done in 0036), and sending to association
  leads or the old waitlist.
- CASL: commercial emails need the sender's mailing address. The footer says "Nanaimo, BC"; Brett to decide whether a
  full mailing address goes in (not legal advice).
