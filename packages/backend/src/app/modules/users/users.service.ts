import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from '@org/shared';
import { hashPassword } from '../../common/password';
import { UsersRepository } from './users.repository';

// TODO(Phase 3): these endpoints are open until the HR auth guard lands.
@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async create(user: CreateUserDto) {
    if (!user.password) {
      throw new BadRequestException('password is required');
    }
    return this.usersRepo.create({
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash: await hashPassword(user.password),
    });
  }

  async findAll() {
    return this.usersRepo.findAll();
  }

  async findOne(id: string) {
    return this.usersRepo.findById(id);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { email, password, ...rest } = updateUserDto;
    return this.usersRepo.update(id, {
      ...rest,
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(password !== undefined ? { passwordHash: await hashPassword(password) } : {}),
    });
  }

  async remove(id: string) {
    return this.usersRepo.delete(id);
  }
}
