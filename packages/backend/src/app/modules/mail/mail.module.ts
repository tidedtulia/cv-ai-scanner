import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** SMTP email sending (Phase 4) */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
