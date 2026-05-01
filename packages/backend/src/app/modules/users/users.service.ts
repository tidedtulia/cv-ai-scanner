import { Injectable } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from '@org/shared';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async create(user: CreateUserDto) {
    return this.usersRepo.create(user);
  }

  async findAll() {
    return this.usersRepo.findAll();
  }

  async findOne(id: string) {
    return this.usersRepo.findById(id);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.usersRepo.update(id, updateUserDto);
  }

  async remove(id: string) {
    return this.usersRepo.delete(id);
  }
}

