/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
    return backendUrl
      ? [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }]
      : [];
  },
};

module.exports = nextConfig;
