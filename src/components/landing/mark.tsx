// The "Puck to teammate" mark at lockup size, as drawn in the design system (components/Logo):
// one colour, the pass always dashed.
export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="9.5" cy="38.5" r="6.5" fill="currentColor" />
      <path d="M17.5 33C21.5 30 24.5 27 27 23.5" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="4.4 3.8" strokeLinecap="round" />
      <path d="M31 18.5 23.06 22.62 27.47 23.35 29.53 27.32Z" fill="currentColor" />
      <circle cx="37.5" cy="10.5" r="7.2" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
