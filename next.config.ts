import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The reference data files are read from disk at runtime; make sure they
  // are traced into the serverless bundle on Vercel for every route.
  outputFileTracingIncludes: {
    "/**": ["./data/**"],
  },
};

export default nextConfig;
