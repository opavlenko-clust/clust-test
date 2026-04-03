const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { nextRuntime }) => {
    // Fix @clerk/shared #crypto and #safe-node-apis Edge Function errors on Vercel
    // by ensuring edge-light package conditions resolve to Edge-compatible modules
    if (nextRuntime === 'edge') {
      config.resolve.conditionNames = [
        'edge-light',
        'worker',
        ...(config.resolve.conditionNames || []),
      ]
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://clerk.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com https://clerk.com https://openrouter.ai",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(
  withPWA(nextConfig),
  {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  }
)
