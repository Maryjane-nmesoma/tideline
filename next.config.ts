import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a build or a second server use its own output folder so it never clobbers a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
