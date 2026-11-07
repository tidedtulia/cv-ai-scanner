import type { HrPositionMessageCode } from '@org/shared';
import type { Dictionary } from '../i18n/dictionaries';

/** Text of an API error `code` in the UI language; an unknown code falls back to the generic message */
export function positionErrorMessage(dict: Dictionary, code: string | undefined): string {
  const messages = dict.hrPositions.errors as Record<string, string>;
  return (code && messages[code as HrPositionMessageCode]) || dict.hrPositions.genericError;
}
