/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SWC minification is enabled by default in Next.js 14
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Don't fail build on TypeScript errors (if any)
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
