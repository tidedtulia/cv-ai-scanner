import { Injectable } from '@nestjs/common';
import {
  CATALOG_CODE_PATTERN,
  CODE_MAX_LENGTH,
  CODE_MIN_LENGTH,
  NAME_MAX_LENGTH,
  catalogCodeFromName,
  withSuffix,
  type IHrCatalogItem,
} from '@org/shared';
import { asRecord, bad, conflict, notFound } from './hr-positions.errors';
import { HrCatalogRepository, type CatalogKind } from './hr-catalog.repository';
import { isUniqueViolation } from './hr-positions.repository';

const MAX_CODE_ATTEMPTS = 50;

/** Job categories and levels (hr-positions AC-9 → AC-11): add, rename, reorder, hide / show — never delete */
@Injectable()
export class HrCatalogService {
  constructor(private readonly repo: HrCatalogRepository) {}

  async list(kind: CatalogKind): Promise<IHrCatalogItem[]> {
    return (await this.repo.list(kind)).map((row) => ({ id: row.id, code: row.code, name: row.name, sortOrder: row.sortOrder, isActive: row.isActive, positionCount: row._count.positions }));
  }

  async create(kind: CatalogKind, body: unknown): Promise<IHrCatalogItem> {
    const input = asRecord(body);
    const name = this.name(input['name']);
    const sortOrder = input['sortOrder'] === undefined || input['sortOrder'] === null ? await this.repo.nextSortOrder(kind) : this.sortOrder(input['sortOrder']);
    if (await this.repo.nameExists(kind, name)) throw conflict('NAME_TAKEN');

    const given = typeof input['code'] === 'string' ? input['code'].trim() : '';
    if (input['code'] !== undefined && input['code'] !== null && input['code'] !== '') {
      if (given.length < CODE_MIN_LENGTH || given.length > CODE_MAX_LENGTH || !CATALOG_CODE_PATTERN.test(given)) throw bad('CODE_INVALID');
      try {
        return await this.created(kind, (await this.repo.create(kind, { code: given, name, sortOrder })).id);
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict('CODE_TAKEN');
        throw error;
      }
    }
    const base = catalogCodeFromName(name) || 'ITEM';
    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
      const code = withSuffix(base, attempt, '_');
      if (await this.repo.codeExists(kind, code)) continue;
      try {
        return await this.created(kind, (await this.repo.create(kind, { code, name, sortOrder })).id);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw conflict('CODE_TAKEN');
  }

  async update(kind: CatalogKind, id: string, body: unknown): Promise<IHrCatalogItem> {
    if (!(await this.repo.findById(kind, id))) throw notFound(kind === 'category' ? 'CATEGORY_NOT_FOUND' : 'LEVEL_NOT_FOUND');
    const input = asRecord(body);
    const data: { name?: string; sortOrder?: number; isActive?: boolean } = {};
    if (input['name'] !== undefined) {
      data.name = this.name(input['name']);
      if (await this.repo.nameExists(kind, data.name, id)) throw conflict('NAME_TAKEN');
    }
    if (input['sortOrder'] !== undefined) data.sortOrder = this.sortOrder(input['sortOrder']);
    if (input['isActive'] !== undefined) {
      if (typeof input['isActive'] !== 'boolean') throw bad('IS_ACTIVE_INVALID');
      data.isActive = input['isActive'];
    }
    if (Object.keys(data).length > 0) await this.repo.update(kind, id, data);
    return this.created(kind, id);
  }

  private async created(kind: CatalogKind, id: string) {
    return (await this.list(kind)).find((item) => item.id === id) as IHrCatalogItem;
  }

  private name(value: unknown): string {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) throw bad('NAME_REQUIRED');
    if (name.length > NAME_MAX_LENGTH) throw bad('NAME_TOO_LONG');
    return name;
  }

  private sortOrder(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || Math.abs(value) > 1_000_000) throw bad('SORT_ORDER_INVALID');
    return value;
  }
}

