import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, PayloadTooLargeException } from '@nestjs/common';
import { APPLICATION_MESSAGES } from '@org/shared';
import type { Response } from 'express';

/**
 * Multer aborts the upload as soon as the CV passes the size limit and Nest turns that into
 * a 413 "File too large". Keep the 413, but with the same message the form shows (AC-2).
 */
@Catch(PayloadTooLargeException)
export class CvTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.PAYLOAD_TOO_LARGE)
      .json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: APPLICATION_MESSAGES.CV_TOO_LARGE,
        error: 'Payload Too Large',
      });
  }
}
