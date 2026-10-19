import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
