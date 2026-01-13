/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // App Router is stable in Next.js 14
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "token-logos.family.co",
      },
    ],
  },
}

module.exports = nextConfig
