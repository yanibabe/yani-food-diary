import type { NextConfig } from "next";

// This app is local-first: every screen is drawn on the phone from data saved
// on the phone, so server pre-rendering features (cacheComponents /
// partialPrefetching) are switched off — they only add warnings here.
const nextConfig: NextConfig = {
  // Round 65: a short build id (the git commit on Vercel) shown on the Profile page, so we can tell which version her phone is running.
  env: { NEXT_PUBLIC_BUILD: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7) },
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
