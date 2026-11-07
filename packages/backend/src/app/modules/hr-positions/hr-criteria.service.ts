import { Injectable } from '@nestjs/common';
import { CRITERION_GUIDE_MAX_LENGTH, CRITERION_TYPES, CRITERION_WEIGHT_MAX, CRITERION_WEIGHT_MIN, NAME_MAX_LENGTH, type CriterionType, type IHrPositionDetail } from '@org/shared';
import { asRecord, bad, conflict, notFound } from './hr-positions.errors';
import { HrPositionsRepository, type CriterionData } from './hr-positions.repository';
import { toDetail } from './position-mapper';

/** Scoring criteria of a job (hr-positions AC-7, AC-8). Every change answers the whole job with the warning of AC-7. */
@Injectable()
export class HrCriteriaService {
  constructor(private readonly repo: HrPositionsRepository) {}

  async add(positionId: string, body: unknown): Promise<IHrPositionDetail> {
    const data = this.validate(asRecord(body), true) as CriterionData;
    const outcome = await this.repo.addCriterion(positionId, data);
    if (outcome.result === 'not-found') throw notFound('POSITION_NOT_FOUND');
    return this.reply(positionId);
  }

  async update(positionId: string, criterionId: string, body: unknown): Promise<IHrPositionDetail> {
    const data = this.validate(asRecord(body), false);
    const outcome = await this.repo.updateCriterion(positionId, criterionId, data);
    if (outcome.result === 'not-found') throw await this.missing(positionId);
    return this.reply(positionId);
  }

  async remove(positionId: string, criterionId: string): Promise<IHrPositionDetail> {
    const outcome = await this.repo.removeCriterion(positionId, criterionId);
    if (outcome.result === 'not-found') throw await this.missing(positionId);
    if (outcome.result === 'last-criterion') throw conflict('LAST_CRITERION');
    return this.reply(positionId);
  }

  async move(positionId: string, criterionId: string, body: unknown): Promise<IHrPositionDetail> {
    const direction = asRecord(body)['direction'];
    if (direction !== 'up' && direction !== 'down') throw bad('DIRECTION_INVALID');
    const outcome = await this.repo.moveCriterion(positionId, criterionId, direction);
    if (outcome.result === 'not-found') throw await this.missing(positionId);
    return this.reply(positionId);
  }

  private async reply(positionId: string): Promise<IHrPositionDetail> {
    const row = await this.repo.findById(positionId);
    if (!row) throw notFound('POSITION_NOT_FOUND');
    return toDetail(row, true);
  }

  /** 404 of the job when it does not exist, otherwise of the criterion */
  private async missing(positionId: string) {
    return (await this.repo.findById(positionId)) ? notFound('CRITERION_NOT_FOUND') : notFound('POSITION_NOT_FOUND');
  }

  private validate(input: Record<string, unknown>, creating: boolean): Partial<CriterionData> {
    const out: Partial<CriterionData> = {};
    const present = (key: string) => creating || input[key] !== undefined;

    if (present('name')) {
      const name = typeof input['name'] === 'string' ? input['name'].trim() : '';
      if (!name) throw bad('NAME_REQUIRED');
      if (name.length > NAME_MAX_LENGTH) throw bad('NAME_TOO_LONG');
      out.name = name;
    }
    if (present('type')) {
      if (typeof input['type'] !== 'string' || !(CRITERION_TYPES as readonly string[]).includes(input['type'])) throw bad('TYPE_INVALID');
      out.type = input['type'] as CriterionType;
    }
    if (present('weight')) {
      const weight = input['weight'];
      if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < CRITERION_WEIGHT_MIN || weight > CRITERION_WEIGHT_MAX) throw bad('WEIGHT_INVALID');
      out.weight = weight;
    }
    if (creating || input['isRequired'] !== undefined) {
      if (typeof input['isRequired'] !== 'boolean') throw bad('IS_REQUIRED_INVALID');
      out.isRequired = input['isRequired'];
    }
    if (input['description'] !== undefined) {
      if (input['description'] !== null && typeof input['description'] !== 'string') throw bad('GUIDE_TOO_LONG');
      const guide = typeof input['description'] === 'string' ? input['description'].trim() : '';
      if (guide.length > CRITERION_GUIDE_MAX_LENGTH) throw bad('GUIDE_TOO_LONG');
      out.description = guide || null;
    } else if (creating) {
      out.description = null;
    }
    return out;
  }
}
