import type { MetadataRoute } from 'next';

// Firstpass installs to the home screen and opens on Today (decision 0021).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/today',
    name: 'Firstpass',
    short_name: 'Firstpass',
    description: 'Practice plans for U5–U9 hockey, ready on your phone at the rink.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#084F68',
    lang: 'en-CA',
    categories: ['sports', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Plans', short_name: 'Plans', url: '/plans', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }],
  };
}
