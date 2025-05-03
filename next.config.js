const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://unifieddata-api-552541459765.us-central1.run.app/api/:path*',
      },
    ];
  },
  webpack: (config) => {
    // Optimize chunking with safe match
    config.optimization.splitChunks.cacheGroups = {
      ...config.optimization.splitChunks.cacheGroups,
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name(module) {
          const match =
            module?.context?.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
          const packageName = match ? match[1] : null;

          if (/handsontable|hyperformula/.test(packageName)) {
            return 'spreadsheet-vendor';
          }
          if (/firebase/.test(packageName)) {
            return 'firebase-vendor';
          }

          return 'vendor';
        },
        priority: 20,
        chunks: 'all',
      },
    };

    return config;
  },
};

module.exports = nextConfig;


