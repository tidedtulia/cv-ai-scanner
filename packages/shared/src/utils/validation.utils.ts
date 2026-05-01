/**
 * Validate an email address format.
 * Usable in both frontend (form validation) and backend (request validation).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
