/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Hostinger Node.js hosting
  output: "standalone",

  experimental: {
    serverComponentsExternalPackages: ["@heygen/streaming-avatar"],
  },

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
