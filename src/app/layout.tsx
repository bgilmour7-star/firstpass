import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Firstpass',
  description: 'Practice plans for U7 hockey coaches.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
