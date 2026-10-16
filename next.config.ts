import type { NextConfig } from "next";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    // Custom rules are matched before the defaults. API responses are per-user
    // and time-sensitive (assignment open times, test windows), so they must never
    // be served from a cache — the default "apis" NetworkFirst rule fell back to a
    // stale copy whenever a phone's network took longer than 10s.
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
          sameOrigin && url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,

  // Production optimizations
  productionBrowserSourceMaps: false,

  // Optimize rendering
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    minimumCacheTTL: 60,
  },

  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-hot-toast'],
  },

  // Turbopack configuration (empty to acknowledge webpack config is intentional)
  turbopack: {},
};

export default withPWA(nextConfig);
