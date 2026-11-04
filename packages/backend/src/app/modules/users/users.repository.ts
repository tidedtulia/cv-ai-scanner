import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Columns returned by the API — `passwordHash` is never selected. */
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data, select: PUBLIC_USER_SELECT });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
  }

  findAll() {
    return this.prisma.user.findMany({ select: PUBLIC_USER_SELECT });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_SELECT,
    });
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id }, select: PUBLIC_USER_SELECT });
  }
}
