import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateUserDto,
  isValidEmail,
  UpdateUserDto,
  USER_MESSAGES,
  USER_NAME_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
  UserMessageCode,
} from '@org/shared';
import { apiException } from '../../common/api-error';
import { hashPassword } from '../../common/password';
import { UsersRepository } from './users.repository';

const userError = (status: HttpStatus, code: UserMessageCode) => apiException(status, code, USER_MESSAGES[code]);
const bad = (code: UserMessageCode) => userError(HttpStatus.BAD_REQUEST, code);

const prismaCode = (error: unknown) => (error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined);

/** HR accounts (/api/hr/users): validation, unique email, no self-delete / self-deactivate (hr-auth AC-8) */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async create(body: unknown) {
    const input = this.validate(body, true) as Required<Pick<CreateUserDto, 'name' | 'email' | 'password'>>;
    const passwordHash = await hashPassword(input.password);
    return this.save(() => this.usersRepo.create({ name: input.name, email: input.email, passwordHash }));
  }

  findAll() {
    return this.usersRepo.findAll();
  }

  async findOne(id: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) throw userError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
    return user;
  }

  async update(id: string, body: unknown, currentUserId: string) {
    const input = this.validate(body, false) as UpdateUserDto;
    if (id === currentUserId && input.isActive === false) throw bad('CANNOT_CHANGE_OWN_ACCOUNT');
    const { password, ...rest } = input;
    const data: Prisma.UserUpdateInput = { ...rest, ...(password !== undefined ? { passwordHash: await hashPassword(password) } : {}) };
    return this.save(() => this.usersRepo.update(id, data));
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw bad('CANNOT_CHANGE_OWN_ACCOUNT');
    return this.save(() => this.usersRepo.delete(id));
  }

  /** Maps Prisma errors: duplicate email → 409, missing row → 404 */
  private async save<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (prismaCode(error) === 'P2002') throw userError(HttpStatus.CONFLICT, 'EMAIL_TAKEN');
      if (prismaCode(error) === 'P2025') throw userError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
      throw error;
    }
  }

  /** Only known fields are kept; on update every field is optional */
  private validate(body: unknown, creating: boolean): UpdateUserDto {
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const out: UpdateUserDto = {};

    if (creating || input['name'] !== undefined) {
      const name = typeof input['name'] === 'string' ? input['name'].trim() : '';
      if (!name) throw bad('NAME_REQUIRED');
      if (name.length > USER_NAME_MAX_LENGTH) throw bad('NAME_TOO_LONG');
      out.name = name;
    }
    if (creating || input['email'] !== undefined) {
      const email = typeof input['email'] === 'string' ? input['email'].trim().toLowerCase() : '';
      if (!isValidEmail(email) || email.length > USER_NAME_MAX_LENGTH) throw bad('EMAIL_INVALID');
      out.email = email;
    }
    if (creating || input['password'] !== undefined) {
      const password = typeof input['password'] === 'string' ? input['password'] : '';
      if (password.length < USER_PASSWORD_MIN_LENGTH || password.length > USER_PASSWORD_MAX_LENGTH) throw bad('PASSWORD_LENGTH');
      out.password = password;
    }
    if (!creating && input['isActive'] !== undefined) {
      if (typeof input['isActive'] !== 'boolean') throw bad('IS_ACTIVE_INVALID');
      out.isActive = input['isActive'];
    }
    return out;
  }
}
