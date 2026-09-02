import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['test.codinx.app'],

  // Prevent reverse proxies and browsers from caching dev JS/CSS chunks.
  // Without this, a proxy like test.codinx.app serves a stale bundle to the
  // browser, which causes React hydration mismatches against fresh SSR HTML.
  async headers() {
    return [
      {
        source: '/_next/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;

