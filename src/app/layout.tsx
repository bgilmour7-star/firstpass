import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Firstpass',
  description: 'Practice plans for U5–U9 hockey coaches.',
  robots: { index: false, follow: false },
  // Installed on an iPhone's home screen (decision 0021): full screen, titled Firstpass.
  appleWebApp: { capable: true, title: 'Firstpass', statusBarStyle: 'default' },
};

// viewport-fit=cover turns on the safe-area spacing the app already has around the notch and home
// bar. The status bar matches the page, so the app's own top bar runs up into it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1416' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
