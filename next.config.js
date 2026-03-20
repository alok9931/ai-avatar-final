/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Hostinger Node.js hosting
  output: "standalone",

  // Prevent SSR of browser-only SDK
  transpilePackages: ["import { StreamingAvatar }"],

  // Allow streaming responses (needed for WebRTC headers)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
