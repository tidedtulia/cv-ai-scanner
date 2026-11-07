//@ts-check

const { join } = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

// Keep the default in sync with src/lib/backend.ts
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  // Monorepo root; otherwise Next.js may pick a lockfile outside the repo as the tracing root
  outputFileTracingRoot: join(__dirname, '../..'),
  transpilePackages: ['@org/shared'],
  // Container image (packages/frontend/Dockerfile): a self-contained server; `npm run dev` / `start` are not affected
  ...(process.env.NEXT_STANDALONE === 'true' && { output: 'standalone' }),
  // The browser calls /api/* on the frontend's origin; Next.js forwards it to the NestJS backend,
  // so no CORS and the backend URL stays server-side (FQ3)
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  experimental: {
    // The rewrite proxy cuts request bodies at 10MB by default, so a CV of exactly CV_MAX_FILE_SIZE_MB (10MB)
    // plus the multipart overhead would never reach the backend. 1MB of headroom lets the backend answer
    // 413 itself for slightly larger files. Keep in sync with CV_MAX_FILE_SIZE_MB in @org/shared.
    proxyClientMaxBodySize: 11 * 1024 * 1024,
  },
  // @org/shared uses nodenext-style `.js` imports for `.ts` sources, which Turbopack can't resolve,
  // so the app runs on webpack (see `--webpack` in package.json nx targets).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
