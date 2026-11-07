import { Injectable } from '@nestjs/common';
import {
  CODE_MAX_LENGTH,
  CODE_MIN_LENGTH,
  MIN_YEARS_MAX,
  POSITION_CODE_PATTERN,
  POSITION_DESCRIPTION_MAX_LENGTH,
  POSITION_STATUSES,
  POSITION_TITLE_MAX_LENGTH,
  positionCodeFromTitle,
  withSuffix,
  type IHrPositionDetail,
  type IHrPositionListItem,
  type PositionStatus,
} from '@org/shared';
import { asRecord, bad, conflict, notFound } from './hr-positions.errors';
import { HrPositionsRepository, isForeignKeyViolation, isUniqueViolation, type PositionRow } from './hr-positions.repository';
import { toDetail, toListItem } from './position-mapper';

const MAX_CODE_ATTEMPTS = 50;

interface PositionFields {
  title?: string;
  description?: string;
  minYearsExperience?: number;
  categoryCode?: string;
  levelCode?: string;
  code?: string;
}

/** Jobs of the HR (hr-positions AC-1 → AC-6) */
@Injectable()
export class HrPositionsService {
  constructor(private readonly repo: HrPositionsRepository) {}

  /** AC-1 */
  async list(query: Record<string, unknown>): Promise<IHrPositionListItem[]> {
    const status = query['status'];
    if (status !== undefined && !(typeof status === 'string' && (POSITION_STATUSES as readonly string[]).includes(status))) {
      throw bad('INVALID_QUERY');
    }
    return (await this.repo.list(status as PositionStatus | undefined)).map(toListItem);
  }

  /** AC-3 */
  async detail(id: string, warn = false): Promise<IHrPositionDetail> {
    return toDetail(await this.load(id), warn);
  }

  /** AC-2: always a DRAFT; the code is generated from the title unless it is given */
  async create(body: unknown): Promise<IHrPositionDetail> {
    const input = this.validate(asRecord(body), true);
    const [category, level] = await Promise.all([this.repo.findCategory(input.categoryCode as string), this.repo.findLevel(input.levelCode as string)]);
    if (!category?.isActive) throw bad('CATEGORY_INVALID');
    if (!level?.isActive) throw bad('LEVEL_INVALID');
    const data = {
      title: input.title as string,
      categoryId: category.id,
      levelId: level.id,
      minYearsExperience: input.minYearsExperience as number,
      description: input.description as string,
    };

    if (input.code) {
      try {
        return this.detail((await this.repo.create({ ...data, code: input.code })).id);
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict('CODE_TAKEN');
        throw error;
      }
    }
    const base = positionCodeFromTitle(data.title) || 'job';
    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
      const code = withSuffix(base, attempt, '-');
      if (await this.repo.codeExists(code)) continue;
      try {
        return await this.detail((await this.repo.create({ ...data, code })).id);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error; // another HR took this code a moment ago: try the next one
      }
    }
    throw conflict('CODE_TAKEN');
  }

  /** AC-4: any status; only the fields sent change; the code cannot be changed */
  async update(id: string, body: unknown): Promise<IHrPositionDetail> {
    const current = await this.load(id);
    const input = this.validate(asRecord(body), false);
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data['title'] = input.title;
    if (input.description !== undefined) data['description'] = input.description;
    if (input.minYearsExperience !== undefined) data['minYearsExperience'] = input.minYearsExperience;
    if (input.categoryCode !== undefined && input.categoryCode.toLowerCase() !== current.category.code.toLowerCase()) {
      const category = await this.repo.findCategory(input.categoryCode);
      if (!category?.isActive) throw bad('CATEGORY_INVALID');
      data['categoryId'] = category.id;
    }
    if (input.levelCode !== undefined && input.levelCode.toLowerCase() !== current.level.code.toLowerCase()) {
      const level = await this.repo.findLevel(input.levelCode);
      if (!level?.isActive) throw bad('LEVEL_INVALID');
      data['levelId'] = level.id;
    }
    if (Object.keys(data).length > 0) await this.repo.update(id, data);

    const touchesAi = ['levelId', 'minYearsExperience', 'description'].some((key) => key in data && this.changed(current, key, data[key]));
    return toDetail(await this.load(id), touchesAi);
  }

  /** AC-5 */
  async setStatus(id: string, body: unknown): Promise<IHrPositionDetail> {
    const status = asRecord(body)['status'];
    if (typeof status !== 'string' || !(POSITION_STATUSES as readonly string[]).includes(status)) throw bad('STATUS_INVALID');
    const current = await this.load(id);
    if (current.status === status) return toDetail(current);
    if (status === 'OPEN' && (current._count.criteria < 1 || !current.description.trim())) throw conflict('CRITERIA_REQUIRED');
    await this.repo.update(id, { status: status as PositionStatus });
    return this.detail(id);
  }

  /** AC-6 */
  async remove(id: string): Promise<{ deleted: true }> {
    try {
      const outcome = await this.repo.deleteIfUnused(id);
      if (outcome.result === 'not-found') throw notFound('POSITION_NOT_FOUND');
      if (outcome.result === 'has-applications') throw conflict('POSITION_HAS_APPLICATIONS', { applicationCount: outcome.applicationCount });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict('POSITION_HAS_APPLICATIONS'); // an application arrived meanwhile
      throw error;
    }
    return { deleted: true };
  }

  private async load(id: string): Promise<PositionRow> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound('POSITION_NOT_FOUND');
    return row;
  }

  private changed(current: PositionRow, key: string, value: unknown) {
    if (key === 'levelId') return true; // a different level was resolved above
    return (current as unknown as Record<string, unknown>)[key] !== value;
  }

  /** AC-2 / AC-4 validation; on update every field is optional */
  private validate(input: Record<string, unknown>, creating: boolean): PositionFields {
    const out: PositionFields = {};
    const present = (key: string) => creating || input[key] !== undefined;

    if (present('title')) {
      const title = typeof input['title'] === 'string' ? input['title'].trim() : '';
      if (!title) throw bad('TITLE_REQUIRED');
      if (title.length > POSITION_TITLE_MAX_LENGTH) throw bad('TITLE_TOO_LONG');
      out.title = title;
    }
    if (present('description')) {
      const description = typeof input['description'] === 'string' ? input['description'].trim() : '';
      if (!description) throw bad('DESCRIPTION_REQUIRED');
      if (description.length > POSITION_DESCRIPTION_MAX_LENGTH) throw bad('DESCRIPTION_TOO_LONG');
      out.description = description;
    }
    if (present('minYearsExperience')) {
      const years = input['minYearsExperience'];
      if (typeof years !== 'number' || !Number.isInteger(years) || years < 0 || years > MIN_YEARS_MAX) throw bad('YEARS_INVALID');
      out.minYearsExperience = years;
    }
    if (present('categoryCode')) {
      if (typeof input['categoryCode'] !== 'string' || !input['categoryCode'].trim()) throw bad('CATEGORY_INVALID');
      out.categoryCode = input['categoryCode'].trim();
    }
    if (present('levelCode')) {
      if (typeof input['levelCode'] !== 'string' || !input['levelCode'].trim()) throw bad('LEVEL_INVALID');
      out.levelCode = input['levelCode'].trim();
    }
    if (creating && input['code'] !== undefined && input['code'] !== null && input['code'] !== '') {
      const code = typeof input['code'] === 'string' ? input['code'].trim() : '';
      if (code.length < CODE_MIN_LENGTH || code.length > CODE_MAX_LENGTH || !POSITION_CODE_PATTERN.test(code)) throw bad('CODE_INVALID');
      out.code = code;
    }
    return out;
  }
}

