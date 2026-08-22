import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agenda Brasil',
    short_name: 'Agenda Brasil',
    description: 'Agendamentos e gestão de barbearia.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#09090b',
    theme_color: '#09090b',
    lang: 'pt-BR',
    categories: ['business', 'lifestyle', 'productivity'],
    shortcuts: [
      { name: 'Agendar horário', short_name: 'Agendar', url: '/agendar', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Minha agenda', short_name: 'Agenda', url: '/dashboard', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
