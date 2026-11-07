import { JWT_SECRET_MIN_LENGTH } from '@org/shared';

/** JWT_SECRET from the environment; the backend refuses to start without a long enough one (AC-7). */
export function readJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env['JWT_SECRET'] ?? '';
  if (!secret) {
    throw new Error('JWT_SECRET is not set: add it to .env (generate one: openssl rand -hex 32)');
  }
  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters (generate one: openssl rand -hex 32)`);
  }
  return secret;
}
