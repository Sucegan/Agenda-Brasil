import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignora os erros de TypeScript no build da Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora erros de linting no build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;