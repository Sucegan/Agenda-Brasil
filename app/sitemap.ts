import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agenda-brasil.vercel.app';
  return ['', '/agendar', '/privacidade', '/termos'].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === '/agendar' ? 'daily' : 'monthly', priority: path === '' ? 1 : 0.7 }));
}
