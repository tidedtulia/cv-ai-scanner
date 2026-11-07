import { addressOf, DEFAULT_PRIVACY_EMAIL, missingMailVariables, readMailConfig } from './mail.config';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;
const gmail = { SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_USER: 'hr@gmail.com', SMTP_PASSWORD: 'app-password', MAIL_FROM: 'CV AI Scanner <hr@gmail.com>' };

describe('readMailConfig (result-email AC-6)', () => {
  it('port 465 → TLS from the start; other ports → STARTTLS; SMTP_SECURE overrides', () => {
    expect(readMailConfig(env(gmail))?.secure).toBe(true);
    expect(readMailConfig(env({ ...gmail, SMTP_PORT: '587' }))?.secure).toBe(false);
    expect(readMailConfig(env({ ...gmail, SMTP_PORT: '587', SMTP_SECURE: 'true' }))?.secure).toBe(true);
    expect(readMailConfig(env({ ...gmail, SMTP_SECURE: 'false' }))?.secure).toBe(false);
  });

  it('reads the connection, sender and reply-to (default: the From address)', () => {
    expect(readMailConfig(env(gmail))).toEqual({
      host: 'smtp.gmail.com', port: 465, secure: true, user: 'hr@gmail.com', password: 'app-password',
      from: 'CV AI Scanner <hr@gmail.com>', replyTo: 'hr@gmail.com', redirectTo: undefined, privacyEmail: DEFAULT_PRIVACY_EMAIL,
    });
    expect(readMailConfig(env({ ...gmail, MAIL_REPLY_TO: 'jobs@example.com' }))?.replyTo).toBe('jobs@example.com');
  });

  it('MAIL_REDIRECT_TO and the privacy address come from the environment; blanks count as unset', () => {
    const config = readMailConfig(env({ ...gmail, MAIL_REDIRECT_TO: ' me@example.com ', NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL: 'p@example.com', MAIL_REPLY_TO: '  ' }));
    expect(config).toMatchObject({ redirectTo: 'me@example.com', privacyEmail: 'p@example.com', replyTo: 'hr@gmail.com' });
  });

  it('SMTP_HOST or MAIL_FROM missing → null (the backend still starts); the missing names are listed', () => {
    expect(readMailConfig(env({ ...gmail, SMTP_HOST: '' }))).toBeNull();
    expect(readMailConfig(env({ ...gmail, MAIL_FROM: '' }))).toBeNull();
    expect(readMailConfig(env({}))).toBeNull();
    expect(missingMailVariables(env({}))).toEqual(['SMTP_HOST', 'MAIL_FROM']);
    expect(missingMailVariables(env(gmail))).toEqual([]);
  });

  it('addressOf takes the address out of "Name <address>"', () => {
    expect(addressOf('CV AI Scanner <hr@gmail.com>')).toBe('hr@gmail.com');
    expect(addressOf(' hr@gmail.com ')).toBe('hr@gmail.com');
  });
});
