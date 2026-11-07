// npm run mail:check [recipient] — smoke-check of docs/features/result-email AC-14 against the real SMTP server.
// Reads SMTP_* / MAIL_* from the root .env (node --env-file, same quoting rules as the backend's dotenv).
// 1) names the variables that are missing, 2) connects + logs in (nodemailer verify), 3) sends ONE test email to
// `recipient`, else MAIL_REDIRECT_TO, else SMTP_USER. Never to a candidate; never prints the password.
import { createTransport } from 'nodemailer';

const env = process.env;
const value = (name) => env[name]?.trim() || undefined;
const ok = (message) => console.log(`  ✓ ${message}`);
const ko = (message) => console.log(`  ✗ ${message}`);

console.log('Mail check (result-email AC-14)');

const host = value('SMTP_HOST');
const from = value('MAIL_FROM');
const user = value('SMTP_USER');
const password = value('SMTP_PASSWORD');
const port = Number(value('SMTP_PORT') ?? 465);
const secure = value('SMTP_SECURE') ? value('SMTP_SECURE').toLowerCase() === 'true' : port === 465;
const replyTo = value('MAIL_REPLY_TO') ?? from?.match(/<([^>]+)>/)?.[1]?.trim() ?? from;

const missing = ['SMTP_HOST', 'MAIL_FROM'].filter((name) => !value(name));
if (host?.includes('gmail')) missing.push(...['SMTP_USER', 'SMTP_PASSWORD'].filter((name) => !value(name)));
if (missing.length) {
  ko(`missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}
ok(`settings found: ${host}:${port} (${secure ? 'TLS' : 'STARTTLS'}), from ${from}, user ${user ?? '(none)'}`);

const transport = createTransport({
  host,
  port,
  secure,
  auth: user ? { user, pass: password } : undefined,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
});

try {
  await transport.verify();
  ok('connected and logged in to the SMTP server');
} catch (error) {
  ko(`cannot connect / log in: ${error.code ?? ''} ${error.responseCode ?? ''} ${error.command ?? ''}`.replace(/\s+/g, ' ').trim());
  if (error.code === 'EAUTH' || error.responseCode === 535) {
    console.log('    Gmail needs an App Password (Google Account → Security → 2-Step Verification → App passwords), not the normal password;');
    console.log('    SMTP_USER must be the same account. Single-quote the value in .env.');
  } else if (['ESOCKET', 'ECONNECTION', 'ETIMEDOUT', 'EDNS'].includes(error.code)) {
    console.log('    Check SMTP_HOST / SMTP_PORT (Gmail: smtp.gmail.com, 465) and the network.');
  }
  process.exit(1);
}

const to = process.argv[2] ?? value('MAIL_REDIRECT_TO') ?? user;
if (!to) {
  ko('no recipient: pass one (npm run mail:check you@example.com) or set MAIL_REDIRECT_TO / SMTP_USER');
  process.exit(1);
}

try {
  const info = await transport.sendMail({
    from,
    to,
    replyTo,
    subject: '[CV AI Scanner] mail:check',
    text: 'This is a test email from `npm run mail:check`. If you can read it, sending result emails works.',
  });
  ok(`test email sent to ${to} (${info.messageId})`);
} catch (error) {
  ko(`sending failed: ${error.code ?? ''} ${error.responseCode ?? ''} ${error.command ?? ''}`.replace(/\s+/g, ' ').trim());
  process.exit(1);
}

console.log('\nAll checks passed. Look in the inbox (and the spam folder) of the recipient.');
