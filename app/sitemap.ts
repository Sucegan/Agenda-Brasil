import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agenda-brasil.vercel.app';
  return ['', '/planos', '/estabelecimentos', '/agendar', '/privacidade', '/termos'].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: ['/agendar', '/estabelecimentos'].includes(path) ? 'daily' : 'monthly', priority: path === '' ? 1 : path === '/planos' ? 0.9 : 0.7 }));
}
