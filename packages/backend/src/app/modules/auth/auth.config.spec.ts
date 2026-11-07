import { readJwtSecret } from './auth.config';

describe('readJwtSecret (hr-auth AC-7)', () => {
  it('returns a secret of at least 32 characters', () => {
    expect(readJwtSecret({ JWT_SECRET: 'x'.repeat(32) })).toBe('x'.repeat(32));
  });

  it.each([
    ['missing', {}, /JWT_SECRET is not set/],
    ['empty', { JWT_SECRET: '' }, /JWT_SECRET is not set/],
    ['too short', { JWT_SECRET: 'x'.repeat(31) }, /at least 32 characters/],
  ])('refuses a %s JWT_SECRET, naming the variable', (_case, env, message) => {
    expect(() => readJwtSecret(env)).toThrow(message);
  });
});
