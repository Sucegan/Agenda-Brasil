import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agenda-brasil.vercel.app';
  return { rules: { userAgent: '*', allow: ['/', '/agendar', '/privacidade', '/termos'], disallow: ['/dashboard', '/api/'] }, sitemap: `${base}/sitemap.xml` };
}
