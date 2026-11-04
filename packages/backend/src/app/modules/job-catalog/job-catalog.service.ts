import { Injectable } from '@nestjs/common';
import { IJobCategory, IJobLevel } from '@org/shared';
import { JobCatalogRepository } from './job-catalog.repository';

@Injectable()
export class JobCatalogService {
  constructor(private readonly catalogRepo: JobCatalogRepository) {}

  async findFilterableCategories(): Promise<IJobCategory[]> {
    return this.catalogRepo.findFilterableCategories();
  }

  async findFilterableLevels(): Promise<IJobLevel[]> {
    return this.catalogRepo.findFilterableLevels();
  }
}
