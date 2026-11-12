import type { NextConfig } from "next";

// This app is local-first: every screen is drawn on the phone from data saved
// on the phone, so server pre-rendering features (cacheComponents /
// partialPrefetching) are switched off — they only add warnings here.
const nextConfig: NextConfig = {
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
