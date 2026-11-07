import { HttpException } from '@nestjs/common';
import { HrCriteriaService } from './hr-criteria.service';
import { HrPositionsRepository } from './hr-positions.repository';
import { row } from './hr-positions.fixtures';

const POS = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const CRIT = '7a1b2c3d-0000-4000-8000-000000000001';

describe('HrCriteriaService (hr-positions AC-7, AC-8)', () => {
  let repo: jest.Mocked<HrPositionsRepository>;
  let service: HrCriteriaService;
  const fail = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), ...(error.getResponse() as Record<string, unknown>) };
  };
  const valid = (over: Record<string, unknown> = {}) => ({ name: ' NestJS ', type: 'TECHNICAL', weight: 3, isRequired: true, description: ' ≥ 2 years ', ...over });

  beforeEach(() => {
    repo = {
      addCriterion: jest.fn().mockResolvedValue({ result: 'done' }),
      updateCriterion: jest.fn().mockResolvedValue({ result: 'done' }),
      removeCriterion: jest.fn().mockResolvedValue({ result: 'done' }),
      moveCriterion: jest.fn().mockResolvedValue({ result: 'done' }),
      findById: jest.fn().mockResolvedValue(row({}, 2)),
    } as unknown as jest.Mocked<HrPositionsRepository>;
    service = new HrCriteriaService(repo);
  });

  it('add(): trims, empty guide → NULL, and answers the whole job with the HAS_APPLICATIONS warning', async () => {
    const detail = await service.add(POS, valid({ description: '   ' }));
    expect(repo.addCriterion).toHaveBeenCalledWith(POS, { name: 'NestJS', type: 'TECHNICAL', weight: 3, isRequired: true, description: null });
    expect(detail).toHaveProperty('warning', 'HAS_APPLICATIONS');
    await service.add(POS, { name: 'A', type: 'LANGUAGE', weight: 1, isRequired: false });
    expect(repo.addCriterion).toHaveBeenLastCalledWith(POS, { name: 'A', type: 'LANGUAGE', weight: 1, isRequired: false, description: null });
  });

  it('no warning when the job has no application', async () => {
    repo.findById.mockResolvedValue(row({}, 0) as never);
    expect(await service.add(POS, valid())).not.toHaveProperty('warning');
  });

  it.each([
    [{ name: '' }, 'NAME_REQUIRED'],
    [{ name: 'x'.repeat(256) }, 'NAME_TOO_LONG'],
    [{ type: 'OTHER' }, 'TYPE_INVALID'],
    [{ type: undefined }, 'TYPE_INVALID'],
    [{ weight: 0 }, 'WEIGHT_INVALID'],
    [{ weight: 6 }, 'WEIGHT_INVALID'],
    [{ weight: 2.5 }, 'WEIGHT_INVALID'],
    [{ weight: '3' }, 'WEIGHT_INVALID'],
    [{ isRequired: 'yes' }, 'IS_REQUIRED_INVALID'],
    [{ description: 'x'.repeat(2001) }, 'GUIDE_TOO_LONG'],
    [{ description: 5 }, 'GUIDE_TOO_LONG'],
  ])('add() %p → 400 %s, nothing written', async (over, code) => {
    expect(await fail(service.add(POS, valid(over)))).toMatchObject({ status: 400, code });
    expect(repo.addCriterion).not.toHaveBeenCalled();
  });

  it('weights 1 and 5 and a 2000-char guide are accepted', async () => {
    await service.add(POS, valid({ weight: 1 }));
    await service.add(POS, valid({ weight: 5, description: 'x'.repeat(2000) }));
    expect(repo.addCriterion).toHaveBeenCalledTimes(2);
  });

  it('update(): only the fields sent', async () => {
    await service.update(POS, CRIT, { weight: 5 });
    expect(repo.updateCriterion).toHaveBeenCalledWith(POS, CRIT, { weight: 5 });
    await service.update(POS, CRIT, { description: null });
    expect(repo.updateCriterion).toHaveBeenLastCalledWith(POS, CRIT, { description: null });
  });

  it('unknown job → 404 POSITION_NOT_FOUND; unknown criterion of an existing job → 404 CRITERION_NOT_FOUND', async () => {
    repo.addCriterion.mockResolvedValueOnce({ result: 'not-found' });
    expect(await fail(service.add(POS, valid()))).toMatchObject({ status: 404, code: 'POSITION_NOT_FOUND' });
    repo.updateCriterion.mockResolvedValueOnce({ result: 'not-found' });
    expect(await fail(service.update(POS, CRIT, { weight: 2 }))).toMatchObject({ status: 404, code: 'CRITERION_NOT_FOUND' });
    repo.removeCriterion.mockResolvedValueOnce({ result: 'not-found' });
    repo.findById.mockResolvedValueOnce(null);
    expect(await fail(service.remove(POS, CRIT))).toMatchObject({ status: 404, code: 'POSITION_NOT_FOUND' });
  });

  it('remove(): the last criterion of an OPEN job → 409 LAST_CRITERION', async () => {
    repo.removeCriterion.mockResolvedValueOnce({ result: 'last-criterion' });
    expect(await fail(service.remove(POS, CRIT))).toMatchObject({ status: 409, code: 'LAST_CRITERION' });
    await expect(service.remove(POS, CRIT)).resolves.toMatchObject({ id: POS });
  });

  it('move(): up / down only', async () => {
    await service.move(POS, CRIT, { direction: 'up' });
    await service.move(POS, CRIT, { direction: 'down' });
    expect(repo.moveCriterion.mock.calls.map((c) => c[2])).toEqual(['up', 'down']);
    for (const body of [{}, { direction: 'left' }, undefined]) {
      expect(await fail(service.move(POS, CRIT, body))).toMatchObject({ status: 400, code: 'DIRECTION_INVALID' });
    }
  });
});
