import type { NextConfig } from 'next';
import { HTML_LIMITED_BOTS } from './src/lib/site/bots';

const nextConfig: NextConfig = {
  // Admin → Send uploads email images (up to 2 MB, decision 0035) through a server action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  // AI crawlers don't run JavaScript, so they get the title, description and canonical in <head> (decision 0047).
  htmlLimitedBots: HTML_LIMITED_BOTS,
  // Production builds start clean. Vercel restores the previous build's webpack cache, and on
  // 2026-10-18 a restored cache left the plan builder out of the server's client manifest
  // ("Could not find the module …/builder.tsx#Builder"), breaking every plan page until a
  // clean build. Builds take under a minute, so the cache isn't worth that risk.
  webpack: (config, { dev }) => {
    if (!dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
