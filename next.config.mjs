/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate dev/build artifacts to avoid HMR chunk corruption when both run.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverComponentsExternalPackages: ["@xmldom/xmldom"],
  },
};

export default nextConfig;
