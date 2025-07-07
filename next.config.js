/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use webpack configuration to handle Node.js modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark these modules as external to avoid bundling them
      config.externals.push('node-telegram-bot-api');
      config.externals.push('@cypress/request');
      config.externals.push('@cypress/request-promise');
    }
    return config;
  },
  // Avoid processing external dependencies for Edge runtime
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

module.exports = nextConfig;
