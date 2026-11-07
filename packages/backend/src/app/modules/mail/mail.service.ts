import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { MAIL_TIMEOUT_MS, readMailConfig, readPrivacyEmail, type MailConfig } from './mail.config';
import type { RenderedEmail } from './mail-templates';

/** Sending failed (not configured, refused, unreachable, timeout…); the cause is logged, never shown to HR */
export class MailSendError extends Error {
  constructor(
    message: string,
    readonly reason: 'not-configured' | 'send-failed',
  ) {
    super(message);
  }
}

/** Tag put in front of the subject when MAIL_REDIRECT_TO diverts an email (AC-6) */
export const redirectSubjectPrefix = (to: string) => `[gửi tới ứng viên: ${to}] `;

/** Sends emails over SMTP (result-email AC-4 → AC-6) */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  readonly config: MailConfig | null;
  private transporter?: Transporter;

  constructor() {
    this.config = readMailConfig();
    if (!this.config) {
      this.logger.warn('Email is not configured (SMTP_HOST / MAIL_FROM missing): result emails cannot be sent');
    } else if (this.config.redirectTo) {
      this.logger.warn(`MAIL_REDIRECT_TO is set: every email goes to ${this.config.redirectTo}, not to the candidate`);
    }
  }

  get privacyEmail(): string {
    return this.config?.privacyEmail ?? readPrivacyEmail();
  }

  /** Where an email for `to` really goes */
  recipientFor(to: string): string {
    return this.config?.redirectTo ?? to;
  }

  /** Resolves when the SMTP server accepted the email; throws MailSendError otherwise */
  async send(to: string, email: RenderedEmail): Promise<void> {
    const config = this.config;
    if (!config) throw new MailSendError('Email is not configured', 'not-configured');

    const target = this.recipientFor(to);
    const subject = config.redirectTo ? `${redirectSubjectPrefix(to)}${email.subject}` : email.subject;
    try {
      await this.transport(config).sendMail({
        from: config.from,
        to: target,
        replyTo: config.replyTo,
        subject,
        text: email.text,
        html: email.html,
      });
    } catch (cause) {
      // Log the kind of failure only: no password, no email content, no candidate address
      const error = cause as { code?: string; responseCode?: number; command?: string; message?: string };
      this.logger.error(
        `Sending email failed: ${[error.code, error.responseCode, error.command].filter(Boolean).join(' ') || error.message || 'unknown error'}`,
      );
      throw new MailSendError('Email could not be sent', 'send-failed');
    }
  }

  private transport(config: MailConfig): Transporter {
    this.transporter ??= createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      connectionTimeout: MAIL_TIMEOUT_MS,
      greetingTimeout: MAIL_TIMEOUT_MS,
      socketTimeout: MAIL_TIMEOUT_MS,
    });
    return this.transporter;
  }
}
