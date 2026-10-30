import type { NextConfig } from 'next';
const backend = process.env.IQI_BACKEND_ORIGIN;
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.IQI_PROXY_TEST === '1' ? '.next/proxy-verification' : '.next',
  experimental: { proxyClientMaxBodySize: '26mb' },
  async rewrites() {
    return backend
      ? [{ source: '/api/:path*', destination: `${new URL(backend).origin}/api/:path*` }]
      : [];
  },
};
export default nextConfig;
