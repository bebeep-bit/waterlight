import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  /* Shadowrocket intercepts `localhost`, so we use 127.0.0.1 in the browser.
     Next.js 16 blocks /_next/* from that host unless it is listed here —
     without it the HTML loads and you can type, but React never hydrates
     and Paint stays disabled. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
