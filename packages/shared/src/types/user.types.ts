/**
 * User (HR account) interface — mirrors the Prisma User model without `passwordHash`,
 * which never leaves the backend.
 * Used by both frontend (display) and backend (response shape).
 */
export interface IUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
