import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { MailSendError, MailService } from './mail.service';
import { renderResultEmail } from './mail-templates';

/** A minimal SMTP server on a local port: it accepts one mail and keeps it, so that the real nodemailer is exercised */
function fakeSmtp() {
  const mails: { from: string; to: string[]; data: string }[] = [];
  const server: Server = createServer((socket) => {
    let buffer = '';
    let inData = false;
    let current = { from: '', to: [] as string[], data: '' };
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply('220 fake ESMTP');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) return;
          current.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          mails.push(current);
          current = { from: '', to: [], data: '' };
          reply('250 OK queued');
          continue;
        }
        const eol = buffer.indexOf('\r\n');
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO')) reply('250 fake');
        else if (command.startsWith('MAIL FROM')) { current.from = line; reply('250 OK'); }
        else if (command.startsWith('RCPT TO')) { current.to.push(line); reply('250 OK'); }
        else if (command === 'DATA') { inData = true; reply('354 go ahead'); }
        else if (command === 'QUIT') { reply('221 bye'); socket.end(); }
        else reply('250 OK');
      }
    });
  });
  return {
    mails,
    start: () => new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Quoted-printable → text (bytes first, then UTF-8) */
const decodeQuotedPrintable = (value: string) =>
  Buffer.from(value.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8');

/** Body of the mail as readable text: the quoted-printable parts decoded */
const decodeBody = (data: string) => decodeQuotedPrintable(data.slice(data.indexOf('\r\n\r\n') + 4));

/** The Subject header, unfolded and with its RFC 2047 words (Q or B) decoded */
const decodeSubject = (data: string) => {
  const header = data.slice(0, data.indexOf('\r\n\r\n')).replace(/\r\n[ \t]+/g, ' ');
  const raw = header.match(/^Subject: (.*)$/m)?.[1] ?? '';
  return raw
    .replace(/\?= =\?/g, '?==?')
    .replace(/=\?UTF-8\?([QB])\?([^?]*)\?=/gi, (_m, kind: string, text: string) =>
      kind.toUpperCase() === 'B'
        ? Buffer.from(text, 'base64').toString('utf8')
        : Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/g, (_x, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8'),
    );
};

const MAIL_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'MAIL_REPLY_TO', 'MAIL_REDIRECT_TO'];

describe('MailService over SMTP (result-email AC-4, AC-6)', () => {
  const smtp = fakeSmtp();
  let port: number;
  const saved: Record<string, string | undefined> = {};
  let logged: string[];
  const email = renderResultEmail({ locale: 'vi', decision: 'ACCEPTED', fullName: 'Nguyễn Văn An', positionTitle: 'Backend Developer', privacyEmail: 'privacy@example.com' });

  const configure = (values: Record<string, string>) => {
    for (const name of MAIL_ENV) delete process.env[name];
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false', MAIL_FROM: 'CV AI Scanner <hr@example.com>' }, values);
    return new MailService();
  };

  beforeAll(async () => {
    for (const name of MAIL_ENV) saved[name] = process.env[name];
    port = await smtp.start();
  });
  afterAll(async () => {
    for (const name of MAIL_ENV) {
      const value = saved[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await smtp.stop();
  });
  beforeEach(() => {
    smtp.mails.length = 0;
    logged = [];
    for (const level of ['warn', 'error'] as const) jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => void logged.push(String(args[0])));
  });
  afterEach(() => jest.restoreAllMocks());

  it('delivers the email to the candidate with From, Reply-To, subject and a text + html body', async () => {
    const service = configure({ MAIL_REPLY_TO: 'jobs@example.com' });
    await service.send('an@example.com', email);

    expect(smtp.mails).toHaveLength(1);
    const [mail] = smtp.mails;
    expect(mail.from).toContain('<hr@example.com>');
    expect(mail.to).toEqual([expect.stringContaining('<an@example.com>')]);
    expect(mail.data).toMatch(/^From: CV AI Scanner <hr@example\.com>/m);
    expect(mail.data).toMatch(/^Reply-To: jobs@example\.com/m);
    expect(mail.data).toMatch(/^To: an@example\.com/m);
    expect(decodeSubject(mail.data)).toBe('Kết quả ứng tuyển: Backend Developer');
    expect(mail.data).toMatch(/Content-Type: multipart\/alternative/);
    const body = decodeBody(mail.data);
    expect(body).toContain('vui mừng thông báo');
  });

  it('Reply-To defaults to the From address', async () => {
    await configure({}).send('an@example.com', email);
    expect(smtp.mails[0].data).toMatch(/^Reply-To: hr@example\.com/m);
  });

  it('MAIL_REDIRECT_TO: every email goes to that address, the subject names the real candidate, Reply-To is unchanged', async () => {
    const service = configure({ MAIL_REDIRECT_TO: 'me@example.com' });
    expect(logged.some((line) => line.includes('MAIL_REDIRECT_TO') && line.includes('me@example.com'))).toBe(true);
    await service.send('an@example.com', email);

    const [mail] = smtp.mails;
    expect(mail.to).toEqual([expect.stringContaining('<me@example.com>')]);
    expect(JSON.stringify(mail.to)).not.toContain('an@example.com');
    expect(mail.data).not.toMatch(/^To: .*an@example\.com/m);
    expect(decodeSubject(mail.data)).toBe('[gửi tới ứng viên: an@example.com] Kết quả ứng tuyển: Backend Developer');
    expect(mail.data).toMatch(/^Reply-To: hr@example\.com/m);
    expect(service.recipientFor('an@example.com')).toBe('me@example.com');
  });

  it('a refused connection → MailSendError("send-failed"); the log has the kind of failure, no password, no address', async () => {
    const service = configure({ SMTP_PORT: '1', SMTP_USER: 'hr@example.com', SMTP_PASSWORD: 'super-secret-app-password' });
    await expect(service.send('an@example.com', email)).rejects.toMatchObject({ name: 'Error', reason: 'send-failed' });
    await expect(service.send('an@example.com', email)).rejects.toBeInstanceOf(MailSendError);
    const log = logged.join('\n');
    expect(log).toMatch(/Sending email failed: ESOCKET/);
    expect(log).not.toContain('super-secret-app-password');
    expect(log).not.toContain('an@example.com');
    expect(log).not.toContain('vui mừng');
  });

  it('not configured → the backend still builds the service, warns once, and sending fails with "not-configured"', async () => {
    for (const name of MAIL_ENV) delete process.env[name];
    const service = new MailService();
    expect(service.config).toBeNull();
    expect(logged.some((line) => line.includes('Email is not configured'))).toBe(true);
    await expect(service.send('an@example.com', email)).rejects.toMatchObject({ reason: 'not-configured' });
    expect(service.privacyEmail).toBe('trantrieu491@gmail.com');
  });
});
