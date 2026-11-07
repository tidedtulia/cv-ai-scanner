import { PrismaService } from '../../database/prisma.service';
import { ApplicationsRepository } from './applications.repository';

describe('ApplicationsRepository', () => {
  const prisma = {
    position: { findFirst: jest.fn().mockResolvedValue(null) },
    application: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
  };
  const repo = new ApplicationsRepository(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('findOpenPosition() only matches OPEN positions, code case-insensitively', async () => {
    await repo.findOpenPosition('Frontend-Dev');

    expect(prisma.position.findFirst).toHaveBeenCalledWith({
      where: { status: 'OPEN', code: { equals: 'Frontend-Dev', mode: 'insensitive' } },
      select: { id: true, code: true },
    });
  });

  it('create() writes the application and its first history row (NULL → SUBMITTED) together', async () => {
    const data = {
      id: 'a1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      locale: 'en' as const,
      positionId: 'p1',
      cvFileName: 'cv.pdf',
      cvDriveFileId: 'f1',
      cvDriveUrl: 'https://drive.google.com/file/d/f1/view',
    };

    await repo.create(data);

    expect(prisma.application.create).toHaveBeenCalledWith({
      data: { ...data, statusHistory: { create: { toStatus: 'SUBMITTED' } } },
      select: { id: true },
    });
  });
});
