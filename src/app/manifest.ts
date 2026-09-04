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
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
