import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Kept free of decorators / Nest imports so prisma/seed.ts can import it under Node type stripping.

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Hash a password with scrypt. Stored format: `scrypt$<salt hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Check a password against a value produced by `hashPassword`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}
