import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options */
  allowedDevOrigins: ['192.168.29.71'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'www.xraitechnolab.com',
      },
    ],
  },
};

export default nextConfig;
