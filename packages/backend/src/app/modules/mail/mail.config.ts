/** SMTP settings from the environment (result-email AC-6) */
export interface MailConfig {
  host: string;
  port: number;
  /** TLS from the first byte (port 465); false = STARTTLS */
  secure: boolean;
  user?: string;
  password?: string;
  /** Sender, e.g. `CV AI Scanner <hr@gmail.com>` */
  from: string;
  /** Where the candidate's replies go (default: the From address) */
  replyTo: string;
  /** Dev / test safety: every email goes here instead of to the candidate */
  redirectTo?: string;
  /** Shown at the foot of the email for data requests */
  privacyEmail: string;
}

export const DEFAULT_PRIVACY_EMAIL = 'trantrieu491@gmail.com';
export const MAIL_TIMEOUT_MS = 15_000;

const text = (value: string | undefined) => value?.trim() || undefined;

export const readPrivacyEmail = (env: NodeJS.ProcessEnv = process.env) =>
  text(env['NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL']) ?? DEFAULT_PRIVACY_EMAIL;

/** The address inside `Name <address>` (or the whole value) */
export const addressOf = (from: string) => from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();

/**
 * Returns null when SMTP is not configured (SMTP_HOST or MAIL_FROM missing): the backend still starts and
 * sending fails with a clear error instead (AC-6).
 */
export function readMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig | null {
  const host = text(env['SMTP_HOST']);
  const from = text(env['MAIL_FROM']);
  if (!host || !from) return null;

  const port = Number(text(env['SMTP_PORT']) ?? 465);
  const secureText = text(env['SMTP_SECURE'])?.toLowerCase();
  return {
    host,
    port,
    secure: secureText ? secureText === 'true' : port === 465,
    user: text(env['SMTP_USER']),
    password: text(env['SMTP_PASSWORD']),
    from,
    replyTo: text(env['MAIL_REPLY_TO']) ?? addressOf(from),
    redirectTo: text(env['MAIL_REDIRECT_TO']),
    privacyEmail: readPrivacyEmail(env),
  };
}

/** Names of the variables that are missing for sending to work (for `mail:check`) */
export function missingMailVariables(env: NodeJS.ProcessEnv = process.env): string[] {
  return ['SMTP_HOST', 'MAIL_FROM'].filter((name) => !text(env[name]));
}
