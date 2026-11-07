import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';
import { applicationErrorBody } from './applications.service';

/**
 * Multer aborts the upload as soon as the CV passes the size limit and Nest turns that into
 * a 413 "File too large". Keep the 413, but with the same message (and code) the form uses (AC-2).
 */
@Catch(PayloadTooLargeException)
export class CvTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.PAYLOAD_TOO_LARGE)
      .json(applicationErrorBody(HttpStatus.PAYLOAD_TOO_LARGE, 'Payload Too Large', 'CV_TOO_LARGE'));
  }
}
