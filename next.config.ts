import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Top-level option for cross-device development
  allowedDevOrigins: ["*", "10.197.33.247", "4ea749eea251eb.lhr.life", "*.lhr.life", "lhr.life"]
};

export default nextConfig;
