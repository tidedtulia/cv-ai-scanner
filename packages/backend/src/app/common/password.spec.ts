import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashPassword() returns a salted scrypt hash, not the plain text', async () => {
    const hash = await hashPassword('s3cret-pass');

    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain('s3cret-pass');
  });

  it('hashPassword() uses a new salt every time', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);

    expect(a).not.toBe(b);
  });

  it('verifyPassword() accepts the right password', async () => {
    const hash = await hashPassword('s3cret-pass');

    await expect(verifyPassword('s3cret-pass', hash)).resolves.toBe(true);
  });

  it('verifyPassword() rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-pass');

    await expect(verifyPassword('wrong-pass', hash)).resolves.toBe(false);
  });

  it('verifyPassword() rejects a value in an unknown format', async () => {
    await expect(verifyPassword('s3cret-pass', 'plain-text')).resolves.toBe(false);
  });
});
