import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The Prisma CLI runs from packages/backend, while the shared .env lives at the repo root.
config({ path: ['.env', '../../.env'], quiet: true });

const databaseUrl = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Node >= 22 runs the TypeScript seed directly (type stripping). The backend package has no
    // "type" field, so Node detects ESM syntax itself — silence that notice rather than change the package type.
    seed: 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
