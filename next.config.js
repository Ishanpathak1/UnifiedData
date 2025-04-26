const isDev = process.env.NODE_ENV === 'development'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: isDev
          ? 'https://unifieddata-api-552541459765.us-central1.run.app/api/:path*'
          : 'https://unifieddata-api-552541459765.us-central1.run.app/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

