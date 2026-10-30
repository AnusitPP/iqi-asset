import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
// Vercel serves Express through the local /api adapter in the same deployment.
const backend = process.env.VERCEL === '1' ? undefined : process.env.IQI_BACKEND_ORIGIN;
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  outputFileTracingIncludes: {
    '/api/*': ['../../backend/src/**/*', '../../shared/**/*'],
  },
  serverExternalPackages: ['express', 'googleapis', 'sharp', 'heic-convert'],
  distDir: process.env.IQI_PROXY_TEST === '1' ? '.next/proxy-verification' : '.next',
  experimental: { proxyClientMaxBodySize: '26mb' },
  async rewrites() {
    return backend
      ? [{ source: '/api/:path*', destination: `${new URL(backend).origin}/api/:path*` }]
      : [];
  },
};
export default nextConfig;
