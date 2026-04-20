// SECURITY: HIGH-2 — Comprehensive security headers for all responses
const securityHeaders = [
  // SECURITY: HIGH-2 — Prevent SSL downgrade attacks
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // SECURITY: HIGH-2 — Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // SECURITY: HIGH-2 — Prevent MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // SECURITY: HIGH-2 — Control referrer information
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // SECURITY: HIGH-2 — Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // SECURITY: HIGH-2 — Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SECURITY: MEDIUM-1 — Remove framework fingerprinting header
  poweredByHeader: false,

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: [],
    outputFileTracingExcludes: {
      '*': [
        '**/@swc/core*',
        '**/@esbuild*',
        '**/node_modules/@next/swc*',
        '**/node_modules/sharp*',
      ],
    },
  },
  images: {
    remotePatterns: [],
  },

  // SECURITY: HIGH-1, HIGH-2 — Security headers and cache control
  async headers() {
    return [
      // SECURITY: HIGH-1 — Prevent CDN caching of auth pages
      {
        source: '/login',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          ...securityHeaders,
        ],
      },
      {
        source: '/change-password',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          ...securityHeaders,
        ],
      },
      // SECURITY: HIGH-2 — Apply security headers to all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
