const isDev = process.env.NODE_ENV === 'development'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // if you still plan to use static export
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: isDev
          ? 'http://localhost:8000/:path*'
          : 'https://unifieddata-api-552541459765.us-central1.run.app/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

