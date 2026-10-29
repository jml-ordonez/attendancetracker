import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // 85 keeps the landing photo crisp; Next 16 rejects qualities not listed here.
    qualities: [75, 85],
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Retired routes: staff tools now live under /admin with one shared shell,
  // and students only have the pass page.
  async redirects() {
    return [
      { source: "/login", destination: "/?auth=admin", permanent: false },
      { source: "/officer/scan", destination: "/admin/scanner", permanent: false },
      { source: "/coordinator/dashboard", destination: "/admin/coordinator", permanent: false },
      { source: "/student/dashboard", destination: "/student/qr", permanent: false },
      { source: "/admin", destination: "/admin/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
