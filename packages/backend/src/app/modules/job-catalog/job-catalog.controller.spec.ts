import { Test, TestingModule } from '@nestjs/testing';
import { JobCatalogController } from './job-catalog.controller';
import { JobCatalogRepository } from './job-catalog.repository';
import { JobCatalogService } from './job-catalog.service';

describe('JobCatalogController', () => {
  let controller: JobCatalogController;
  let repo: jest.Mocked<JobCatalogRepository>;

  const developer = { code: 'DEVELOPER', name: 'Developer' };
  const middle = { code: 'MIDDLE', name: 'Middle' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobCatalogController],
      providers: [
        JobCatalogService,
        {
          provide: JobCatalogRepository,
          useValue: {
            findFilterableCategories: jest.fn().mockResolvedValue([developer]),
            findFilterableLevels: jest.fn().mockResolvedValue([middle]),
          },
        },
      ],
    }).compile();

    controller = module.get<JobCatalogController>(JobCatalogController);
    repo = module.get(JobCatalogRepository);
  });

  it('findCategories() returns the filterable categories', async () => {
    await expect(controller.findCategories()).resolves.toEqual([developer]);
    expect(repo.findFilterableCategories).toHaveBeenCalled();
  });

  it('findLevels() returns the filterable levels', async () => {
    await expect(controller.findLevels()).resolves.toEqual([middle]);
    expect(repo.findFilterableLevels).toHaveBeenCalled();
  });
});
