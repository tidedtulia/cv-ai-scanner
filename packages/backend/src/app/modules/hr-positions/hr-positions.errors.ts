import { HttpStatus } from '@nestjs/common';
import { HR_POSITION_MESSAGES, type HrPositionMessageCode } from '@org/shared';
import { apiException } from '../../common/api-error';

export const positionError = (status: HttpStatus, code: HrPositionMessageCode, extra?: Record<string, unknown>) =>
  apiException(status, code, HR_POSITION_MESSAGES[code], extra);
export const bad = (code: HrPositionMessageCode) => positionError(HttpStatus.BAD_REQUEST, code);
export const notFound = (code: HrPositionMessageCode) => positionError(HttpStatus.NOT_FOUND, code);
export const conflict = (code: HrPositionMessageCode, extra?: Record<string, unknown>) => positionError(HttpStatus.CONFLICT, code, extra);

/** The JSON object of a request body, or {} */
export const asRecord = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {});
