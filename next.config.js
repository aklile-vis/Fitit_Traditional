/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = config.watchOptions ?? {}

      const ignored = config.watchOptions.ignored
      const ignorePatterns = [
        '**/file_storage/**',
        '**/processed/**',
        '**/uploads/**',
        '**/models/**',
        '**/output/**',
        '**/legacy/**',
        '**/backend/.venv/**',
      ]

      if (Array.isArray(ignored)) {
        config.watchOptions.ignored = [...ignored, ...ignorePatterns]
      } else if (ignored) {
        config.watchOptions.ignored = [ignored, ...ignorePatterns]
      } else {
        config.watchOptions.ignored = ignorePatterns
      }
    }

    return config
  },
  async redirects() {
    return [
      {
        source: '/agent/upload-simple',
        destination: '/agent/upload',
        permanent: false,
      },
      {
        source: '/agent/upload-direct',
        destination: '/agent/upload',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
