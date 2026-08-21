/** @type {import('next').Next.Config} */
const nextConfig = {
  typescript: {
    // Ignora erros de TypeScript durante o build na Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora erros de lint durante o build
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;