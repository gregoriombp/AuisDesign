import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Per-user build cache. This repo is one shared folder used by two macOS
  // accounts (gregorio + the shared-Claude "germano" user). A single .next
  // gets cross-user permission errors ("Operation not permitted") and crashes
  // the dev server, so each account points NEXT_DIST_DIR at its own dir via
  // its shell profile (germano -> .next-germano). Default stays .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Pin the workspace root so Turbopack doesn't pick up the stray
  // ~/package-lock.json (left behind by global `shadcn` install).
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Dev-only allowlist for the hosts the preview is opened from. Without the
  // matching origin here, Next blocks its cross-origin dev resources (HMR
  // socket + RSC runtime) and the page renders but never hydrates — clicks die
  // and client-only bits (e.g. the random login brand image) stay blank.
  // `localhost`/`*.local` cover local + mDNS; `127.0.0.1` and the private LAN
  // ranges cover the team opening it via the active interface IP (re-scanned
  // each start, so a wildcard beats a pinned IP). `*` matches one segment.
  allowedDevOrigins: [
    'localhost',
    '*.local',
    '127.0.0.1',
    '192.168.*.*',
    '10.*.*.*',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.figma.com',
        pathname: '/api/mcp/asset/**',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  async rewrites() {
    return [
      { source: '/design', destination: '/design.html' },
    ];
  },
  async redirects() {
    return [
      { source: '/styleguide', destination: '/auis/styleguide', permanent: false },
      { source: '/styleguide/:path*', destination: '/auis/styleguide/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
