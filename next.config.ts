import type { NextConfig } from 'next';
const nextConfig:NextConfig={
  images:{minimumCacheTTL:86400,remotePatterns:[{protocol:'https',hostname:'**.supabase.co',pathname:'/storage/v1/object/public/profile-photos/**'},{protocol:'https',hostname:'**.supabase.co',pathname:'/storage/v1/object/public/activity-proofs/**'}]},
  async headers(){return [{source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},{key:'Service-Worker-Allowed',value:'/'},{key:'Content-Type',value:'application/javascript; charset=utf-8'}]}];},
};
export default nextConfig;
