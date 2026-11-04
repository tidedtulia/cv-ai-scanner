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
    // Node >= 22 runs the TypeScript seed directly (type stripping)
    seed: 'node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
