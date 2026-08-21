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
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
