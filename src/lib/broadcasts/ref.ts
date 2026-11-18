/** An update email link tag, ?from=<ref>-<n> (decision 0036). Its own module so every page can use it without zod. */
export const EMAIL_REF = /^([0-9a-f]{8})-(\d{1,2})$/;
