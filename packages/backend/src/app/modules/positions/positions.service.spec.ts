import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PositionsRepository } from './positions.repository';
import { PositionsService } from './positions.service';

describe('PositionsService', () => {
  let service: PositionsService;
  let repo: jest.Mocked<PositionsRepository>;

  const summary = {
    code: 'frontend-dev',
    title: 'Frontend Developer',
    minYearsExperience: 2,
    category: { code: 'DEVELOPER', name: 'Developer' },
    level: { code: 'MIDDLE', name: 'Middle' },
    criteria: [{ name: 'React / Next.js', type: 'TECHNICAL' as const }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionsService,
        {
          provide: PositionsRepository,
          useValue: {
            findOpen: jest.fn(),
            findOpenByCode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PositionsService>(PositionsService);
    repo = module.get(PositionsRepository);
  });

  it('findOpen() returns the open positions from repository', async () => {
    repo.findOpen.mockResolvedValue([summary]);

    await expect(service.findOpen({ category: 'DEVELOPER' })).resolves.toEqual([summary]);
    expect(repo.findOpen).toHaveBeenCalledWith({ category: 'DEVELOPER', level: undefined });
  });

  it('findOpen() trims filters and ignores blank or repeated query params', async () => {
    repo.findOpen.mockResolvedValue([]);

    await service.findOpen({ category: '  developer ', level: '   ' });
    expect(repo.findOpen).toHaveBeenLastCalledWith({ category: 'developer', level: undefined });

    await service.findOpen({ category: ['A', 'B'] as unknown as string });
    expect(repo.findOpen).toHaveBeenLastCalledWith({ category: undefined, level: undefined });
  });

  it('findOpenByCode() returns the position detail', async () => {
    const detail = { ...summary, description: '## About the role' };
    repo.findOpenByCode.mockResolvedValue(detail);

    await expect(service.findOpenByCode(' frontend-dev ')).resolves.toBe(detail);
    expect(repo.findOpenByCode).toHaveBeenCalledWith('frontend-dev');
  });

  it('findOpenByCode() throws 404 when the position is missing or not OPEN', async () => {
    repo.findOpenByCode.mockResolvedValue(null);

    await expect(service.findOpenByCode('closed-job')).rejects.toThrow(NotFoundException);
    await expect(service.findOpenByCode('closed-job')).rejects.toThrow('Position not found');
  });
});
