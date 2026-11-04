import { Injectable, NotFoundException } from '@nestjs/common';
import { IPublicPositionDetail, IPublicPositionSummary } from '@org/shared';
import { PositionFilters, PositionsRepository } from './positions.repository';

/** Query params can arrive as arrays (?level=a&level=b) or blanks — keep a single non-empty string. */
const normalizeCode = (value: unknown) => (typeof value === 'string' && value.trim()) || undefined;

@Injectable()
export class PositionsService {
  constructor(private readonly positionsRepo: PositionsRepository) {}

  async findOpen(filters: PositionFilters): Promise<IPublicPositionSummary[]> {
    return this.positionsRepo.findOpen({
      category: normalizeCode(filters.category),
      level: normalizeCode(filters.level),
    });
  }

  async findOpenByCode(code: string): Promise<IPublicPositionDetail> {
    const position = await this.positionsRepo.findOpenByCode(code.trim());
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    return position;
  }
}
