import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KG Stay Active Challenge',
    short_name: 'KG Active',
    description: 'Log fitness activities, follow standings, and move your column forward.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#07122f',
    theme_color: '#07122f',
    orientation: 'portrait-primary',
    categories: ['fitness', 'sports', 'health'],
    icons: [
      { src: '/kg-gorilla-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/kg-gorilla-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/kg-gorilla-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
