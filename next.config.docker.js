/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};
module.exports = nextConfig;
