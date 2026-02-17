import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack resolution scoped to this project folder.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
