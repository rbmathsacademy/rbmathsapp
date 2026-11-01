import type { NextConfig } from "next";
import { writeFileSync } from "fs";
import { join } from "path";

// One id per deployment. Open tabs compare it with /version.json to notice a newer deployment
// (see app/components/DeployRecovery.tsx). The file is a static asset, so checking it costs no server CPU.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`;
try { writeFileSync(join(process.cwd(), "public", "version.json"), JSON.stringify({ id: BUILD_ID })); } catch { }
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
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

  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },

  // Turbopack configuration (empty to acknowledge webpack config is intentional)
  turbopack: {},
};

export default withPWA(nextConfig);
