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
      allowedOrigins: ['localhost:3000', 'autoforward-jade.vercel.app'],
    },
    // Enable serverComponentsExternalPackages for better module handling
    serverComponentsExternalPackages: ['node-telegram-bot-api'],
  },
  // Explicitly set the runtime for API routes
  serverRuntimeConfig: {
    // Will only be available on the server side
    PROJECT_ROOT: __dirname,
  },
};

module.exports = nextConfig;
