import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** For the login check only: the only place that reads passwordHash */
  findForLogin(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, isActive: true },
    });
  }

  /** The HR behind a session, if the account still exists and is active */
  findActiveSessionUser(id: string) {
    return this.prisma.user.findFirst({ where: { id, isActive: true }, select: { id: true, name: true, email: true } });
  }
}
