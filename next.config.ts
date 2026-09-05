import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/profile-photos/**' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/activity-proofs/**' },
    ],
  },
};

export default nextConfig;
