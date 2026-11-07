import { HttpException, HttpStatus } from '@nestjs/common';

const STATUS_TEXT: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported Media Type',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
};

/**
 * Error body shared by the API: `{ statusCode, error, code, message }` (the code lets the bilingual UI translate it),
 * plus optional extra fields (e.g. `currentStatus` on a 409)
 */
export function apiErrorBody<Code extends string>(statusCode: HttpStatus, code: Code, message: string, extra: Record<string, unknown> = {}) {
  return { statusCode, error: STATUS_TEXT[statusCode] ?? 'Error', code, message, ...extra };
}

export function apiException<Code extends string>(statusCode: HttpStatus, code: Code, message: string, extra?: Record<string, unknown>) {
  return new HttpException(apiErrorBody(statusCode, code, message, extra), statusCode);
}
