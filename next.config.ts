import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output enabled via env flag for Docker deployments to avoid Turbopack NFT tracing panics
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
