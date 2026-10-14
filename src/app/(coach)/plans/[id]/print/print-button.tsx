'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200">
      Print
    </button>
  );
}
