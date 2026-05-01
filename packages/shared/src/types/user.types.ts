/**
 * User interface — mirrors the Prisma User model.
 * Used by both frontend (display) and backend (response shape).
 */
export interface IUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
