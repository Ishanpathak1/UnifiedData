const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  ...(isDev && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/:path*',
        },
      ];
    },
  }),
};
