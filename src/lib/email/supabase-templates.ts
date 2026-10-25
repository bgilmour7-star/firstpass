// The Supabase Auth email templates (decision 0013), built from the same frame as the app's own
// emails. scripts/email-templates.ts writes them to supabase/templates/*.html for pasting into
// Supabase; the email journey registry (journeys.ts) shows them on Admin → Emails.
//
// Every link is our emailRedirectTo (an /auth/confirm URL that already carries ?next=… and, from a
// join link, &join=…) plus the one-time token, so it works in any browser or app. Every sign-in
// email also carries the 6-digit code, for when the email opens on another device.
import { shell } from './layout';

export type SupabaseTemplate = 'magic-link' | 'confirm-signup' | 'reset-password' | 'change-email';

const site = 'https://firstpass.coach';
const link = (type: string) => `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${type}`;
const notMe = "Didn't ask for this? Ignore it. Someone may have typed your address by mistake, and nothing happens without the code.";

export const SUPABASE_TEMPLATES: Record<SupabaseTemplate, { subject: string; html: string }> = {
  'magic-link': {
    subject: 'Your Firstpass code: {{ .Token }}',
    html: shell({
      site,
      preheader: 'Enter it on the screen you came from, or tap the button.',
      heading: 'Sign in to Firstpass',
      paragraphs: ['Enter this code on the screen you came from:'],
      code: '{{ .Token }}',
      afterCode: ['Or tap the button to sign in on this device.'],
      button: { label: 'Sign in', url: link('email') },
      note: 'The code and button work once, for one hour.',
      footer: [notMe],
    }),
  },
  'confirm-signup': {
    subject: 'Your Firstpass code: {{ .Token }}',
    html: shell({
      site,
      preheader: 'Enter it to confirm your email.',
      heading: 'Confirm your email{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}',
      paragraphs: ['Enter this code on the screen you came from:'],
      code: '{{ .Token }}',
      afterCode: ['Or tap the button to confirm on this device.'],
      button: { label: '{{ if .Data.join_team }}Confirm and join{{ else }}Confirm and continue{{ end }}', url: link('signup') },
      note: 'The code and button work once, for one hour.',
      footer: [notMe],
    }),
  },
  'reset-password': {
    subject: 'Set your Firstpass password',
    html: shell({
      site,
      preheader: 'The link works once, for one hour.',
      heading: 'Set a new password',
      paragraphs: ["Tap below to choose a password for {{ .Email }}. You'll be signed in when you save it."],
      button: { label: 'Set password', url: link('recovery') },
      note: 'The link works once, for one hour.',
      footer: ["Didn't ask for this? Ignore it. Your password stays as it is."],
    }),
  },
  'change-email': {
    subject: 'Confirm your new Firstpass email',
    html: shell({
      site,
      preheader: 'Your sign-in email changes once you confirm.',
      heading: 'Confirm your new email',
      paragraphs: ['You asked to sign in to Firstpass with {{ .NewEmail }} instead of {{ .Email }}. Tap below to confirm. We sent this to both addresses; your email changes once it’s confirmed.'],
      button: { label: 'Confirm new email', url: link('email_change') },
      note: 'The link works once, for one hour.',
      footer: ["Didn't ask for this? Ignore it, and your email stays as it is."],
    }),
  },
};
