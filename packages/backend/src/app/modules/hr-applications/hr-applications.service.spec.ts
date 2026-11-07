import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HR_APPLICATION_MESSAGES } from '@org/shared';
import { CvStorage } from '../applications/storage/cv-storage';
import { HrApplicationsRepository } from './hr-applications.repository';
import { HrApplicationsService } from './hr-applications.service';

const APP_ID = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const HR_ID = '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11';

const detailRow = (status = 'EVALUATED', withEvaluation = true) => ({
  id: APP_ID,
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  status,
  createdAt: new Date('2026-11-06T17:30:00Z'),
  cvFileName: 'CV Nguyễn Văn A.pdf',
  position: { code: 'backend-dev', title: 'Backend Developer', minYearsExperience: 2, status: 'OPEN', category: { name: 'Developer' }, level: { code: 'MIDDLE', name: 'Middle' } },
  evaluation: withEvaluation
    ? {
        overallScore: new Prisma.Decimal('83.33'),
        recommendation: 'RECOMMENDED',
        summary: 'Tốt',
        strengths: ['NestJS'],
        weaknesses: ['Ít Prisma', 3],
        criteriaScores: [{ criterion_id: 'c1', name: 'NestJS', type: 'TECHNICAL', weight: 5, is_required: true, score: 9, reasoning: 'r', evidence: 'e' }],
        estimatedYearsExperience: new Prisma.Decimal('3.5'),
        estimatedLevel: { code: 'MIDDLE', name: 'Middle' },
        aiModel: 'claude-sonnet-5-5',
        promptVersion: 'v1',
        updatedAt: new Date('2026-11-07T17:01:00Z'),
      }
    : null,
  statusHistory: [
    { fromStatus: null, toStatus: 'SUBMITTED', note: null, createdAt: new Date('2026-11-06T17:30:00Z'), changedBy: null },
    { fromStatus: 'EVALUATING', toStatus: 'EVALUATED', note: 'n8n: đánh giá xong', createdAt: new Date('2026-11-07T17:01:00Z'), changedBy: null },
  ],
});

describe('HrApplicationsService (hr-applications)', () => {
  let repo: jest.Mocked<HrApplicationsRepository>;
  let storage: { download: jest.Mock };
  let service: HrApplicationsService;
  const fail = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), ...(error.getResponse() as Record<string, unknown>) };
  };

  beforeEach(() => {
    repo = {
      listPage: jest.fn().mockResolvedValue([]),
      countByStatus: jest.fn().mockResolvedValue({}),
      filterOptions: jest.fn(),
      findDetail: jest.fn().mockResolvedValue(detailRow()),
      findOthersByEmail: jest.fn().mockResolvedValue([]),
      findCvFile: jest.fn().mockResolvedValue({ cvDriveFileId: 'drive-1', cvFileName: 'CV Nguyễn Văn A.pdf' }),
      changeStatus: jest.fn().mockResolvedValue({ result: 'done' }),
    } as unknown as jest.Mocked<HrApplicationsRepository>;
    storage = { download: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7')) };
    jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new HrApplicationsService(repo, storage as unknown as CvStorage);
  });

  describe('list() (AC-1, AC-2)', () => {
    it.each([
      [{}, ['EVALUATED', 'EVALUATION_FAILED'], 'score'],
      [{ tab: 'to-decide' }, ['EVALUATED', 'EVALUATION_FAILED'], 'score'],
      [{ tab: 'pending' }, ['SUBMITTED', 'EVALUATING'], 'newest'],
      [{ tab: 'decided' }, ['ACCEPTED', 'REJECTED'], 'newest'],
      [{ tab: 'all' }, ['SUBMITTED', 'EVALUATING', 'EVALUATED', 'EVALUATION_FAILED', 'ACCEPTED', 'REJECTED'], 'newest'],
      [{ tab: 'all', sort: 'score' }, ['SUBMITTED', 'EVALUATING', 'EVALUATED', 'EVALUATION_FAILED', 'ACCEPTED', 'REJECTED'], 'score'],
      [{ tab: 'to-decide', sort: 'newest' }, ['EVALUATED', 'EVALUATION_FAILED'], 'newest'],
    ])('%p → statuses %p, sort %s', async (query, statuses, sort) => {
      const result = await service.list(query);
      expect(repo.listPage).toHaveBeenCalledWith(expect.anything(), statuses, sort, 0, 20);
      expect(result.sort).toBe(sort);
    });

    it('page n skips (n-1) × 20; filters are trimmed, empty ones ignored', async () => {
      await service.list({ page: '3', q: '  nguyen ', position: 'backend-dev', category: '', level: ' MIDDLE ', recommendation: 'CONSIDER' });
      expect(repo.listPage).toHaveBeenCalledWith(
        { position: 'backend-dev', category: undefined, level: 'MIDDLE', recommendation: 'CONSIDER', q: 'nguyen' },
        expect.anything(), 'score', 40, 20,
      );
    });

    it('counts every tab from the per-status counts; total = count of the current tab; rows mapped', async () => {
      repo.countByStatus.mockResolvedValue({ SUBMITTED: 2, EVALUATING: 1, EVALUATED: 4, EVALUATION_FAILED: 1, REJECTED: 3 });
      repo.listPage.mockResolvedValue([
        { id: 'a1', full_name: 'A', email: 'a@x.co', status: 'EVALUATED', created_at: new Date('2026-11-01T00:00:00Z'), position_code: 'backend-dev', position_title: 'Backend', category_name: 'Developer', level_name: 'Middle', overall_score: new Prisma.Decimal('83.33'), recommendation: 'RECOMMENDED' },
        { id: 'a2', full_name: 'B', email: 'b@x.co', status: 'EVALUATION_FAILED', created_at: new Date('2026-11-02T00:00:00Z'), position_code: 'backend-dev', position_title: 'Backend', category_name: 'Developer', level_name: 'Middle', overall_score: null, recommendation: null },
      ]);
      const result = await service.list({});
      expect(result.counts).toEqual({ 'to-decide': 5, pending: 3, decided: 3, all: 11 });
      expect(result.total).toBe(5);
      expect(result.items[0]).toEqual({ id: 'a1', fullName: 'A', email: 'a@x.co', status: 'EVALUATED', createdAt: '2026-11-01T00:00:00.000Z', position: { code: 'backend-dev', title: 'Backend', category: 'Developer', level: 'Middle' }, overallScore: 83.33, recommendation: 'RECOMMENDED' });
      expect(result.items[1]).toMatchObject({ overallScore: null, recommendation: null });
    });

    it.each([
      [{ tab: 'bogus' }],
      [{ sort: 'name' }],
      [{ recommendation: 'MAYBE' }],
      [{ page: '0' }],
      [{ page: '-1' }],
      [{ page: '1.5' }],
      [{ page: 'abc' }],
      [{ tab: ['all', 'pending'] }],
      [{ q: 'x'.repeat(256) }],
    ])('rejects %p with 400 INVALID_QUERY', async (query) => {
      expect(await fail(service.list(query))).toMatchObject({ status: 400, code: 'INVALID_QUERY', message: HR_APPLICATION_MESSAGES.INVALID_QUERY });
      expect(repo.listPage).not.toHaveBeenCalled();
    });
  });

  describe('detail() (AC-4)', () => {
    it('maps the application, the evaluation (numbers), the history and the actions', async () => {
      repo.findOthersByEmail.mockResolvedValue([{ id: 'o1', status: 'REJECTED', createdAt: new Date('2026-01-01T00:00:00Z'), position: { title: 'Frontend' }, evaluation: { overallScore: new Prisma.Decimal('40') } }] as never);
      const detail = await service.detail(APP_ID);
      expect(detail).toMatchObject({
        id: APP_ID,
        status: 'EVALUATED',
        createdAt: '2026-11-06T17:30:00.000Z',
        position: { code: 'backend-dev', category: 'Developer', level: { code: 'MIDDLE', name: 'Middle' }, minYearsExperience: 2, status: 'OPEN' },
        evaluation: { overallScore: 83.33, estimatedYearsExperience: 3.5, model: 'claude-sonnet-5-5', promptVersion: 'v1', evaluatedAt: '2026-11-07T17:01:00.000Z', weaknesses: ['Ít Prisma'] },
        otherApplications: [{ id: 'o1', positionTitle: 'Frontend', status: 'REJECTED', createdAt: '2026-01-01T00:00:00.000Z', overallScore: 40 }],
        canDecide: true,
        canReEvaluate: true,
      });
      expect(detail.history).toEqual([
        { fromStatus: null, toStatus: 'SUBMITTED', note: null, createdAt: '2026-11-06T17:30:00.000Z', changedBy: null },
        { fromStatus: 'EVALUATING', toStatus: 'EVALUATED', note: 'n8n: đánh giá xong', createdAt: '2026-11-07T17:01:00.000Z', changedBy: null },
      ]);
      expect(JSON.stringify(detail)).not.toMatch(/cvDrive|drive-1/);
      expect(repo.findOthersByEmail).toHaveBeenCalledWith('a@example.com', APP_ID);
    });

    it.each([
      ['SUBMITTED', false],
      ['EVALUATING', false],
      ['EVALUATED', true],
      ['EVALUATION_FAILED', true],
      ['ACCEPTED', false],
      ['REJECTED', false],
    ])('%s → canDecide / canReEvaluate = %s', async (status, allowed) => {
      repo.findDetail.mockResolvedValue(detailRow(status, false) as never);
      const detail = await service.detail(APP_ID);
      expect([detail.canDecide, detail.canReEvaluate, detail.evaluation]).toEqual([allowed, allowed, null]);
    });

    it('unknown id → 404 APPLICATION_NOT_FOUND', async () => {
      repo.findDetail.mockResolvedValue(null);
      expect(await fail(service.detail(APP_ID))).toMatchObject({ status: 404, code: 'APPLICATION_NOT_FOUND' });
    });
  });

  describe('cv() (AC-5)', () => {
    it('returns the bytes and the original file name', async () => {
      await expect(service.cv(APP_ID)).resolves.toEqual({ content: Buffer.from('%PDF-1.7'), fileName: 'CV Nguyễn Văn A.pdf' });
      expect(storage.download).toHaveBeenCalledWith('drive-1');
    });

    it('no application → 404 APPLICATION_NOT_FOUND; file gone → 404 CV_NOT_FOUND; storage error → 502 CV_UNAVAILABLE', async () => {
      repo.findCvFile.mockResolvedValueOnce(null);
      expect(await fail(service.cv(APP_ID))).toMatchObject({ status: 404, code: 'APPLICATION_NOT_FOUND' });
      storage.download.mockResolvedValueOnce(null);
      expect(await fail(service.cv(APP_ID))).toMatchObject({ status: 404, code: 'CV_NOT_FOUND' });
      storage.download.mockRejectedValueOnce(new Error('invalid_grant: token expired'));
      const unavailable = await fail(service.cv(APP_ID));
      expect(unavailable).toMatchObject({ status: 502, code: 'CV_UNAVAILABLE' });
      expect(JSON.stringify(unavailable)).not.toContain('invalid_grant');
    });
  });

  describe('decide() (AC-6)', () => {
    it.each([
      ['ACCEPTED', '  Phù hợp  ', 'Phù hợp'],
      ['REJECTED', undefined, null],
      ['REJECTED', '   ', null],
      ['ACCEPTED', null, null],
    ])('%s with note %p → stored note %p, by the signed-in HR, from EVALUATED / EVALUATION_FAILED', async (decision, note, stored) => {
      await service.decide(APP_ID, { decision, note }, HR_ID);
      expect(repo.changeStatus).toHaveBeenCalledWith(APP_ID, ['EVALUATED', 'EVALUATION_FAILED'], decision, stored, HR_ID);
    });

    it('returns the updated detail', async () => {
      await expect(service.decide(APP_ID, { decision: 'ACCEPTED' }, HR_ID)).resolves.toMatchObject({ id: APP_ID });
    });

    it.each([
      [{}, 'DECISION_INVALID'],
      [{ decision: 'accepted' }, 'DECISION_INVALID'],
      [{ decision: 'SUBMITTED' }, 'DECISION_INVALID'],
      [undefined, 'DECISION_INVALID'],
      [{ decision: 'ACCEPTED', note: 42 }, 'NOTE_TOO_LONG'],
      [{ decision: 'ACCEPTED', note: 'x'.repeat(2001) }, 'NOTE_TOO_LONG'],
    ])('rejects %p with 400 %s, nothing written', async (body, code) => {
      expect(await fail(service.decide(APP_ID, body, HR_ID))).toMatchObject({ status: 400, code });
      expect(repo.changeStatus).not.toHaveBeenCalled();
    });

    it('a note of exactly 2000 characters is accepted', async () => {
      await service.decide(APP_ID, { decision: 'ACCEPTED', note: 'x'.repeat(2000) }, HR_ID);
      expect(repo.changeStatus).toHaveBeenCalled();
    });

    it('status not allowed → 409 STATUS_NOT_ALLOWED with the current status; unknown → 404', async () => {
      repo.changeStatus.mockResolvedValueOnce({ result: 'not-allowed', status: 'ACCEPTED' });
      expect(await fail(service.decide(APP_ID, { decision: 'REJECTED' }, HR_ID))).toEqual({
        status: 409, statusCode: 409, error: 'Conflict', code: 'STATUS_NOT_ALLOWED', message: HR_APPLICATION_MESSAGES.STATUS_NOT_ALLOWED, currentStatus: 'ACCEPTED',
      });
      repo.changeStatus.mockResolvedValueOnce({ result: 'not-allowed', status: undefined });
      expect(await fail(service.decide(APP_ID, { decision: 'REJECTED' }, HR_ID))).toMatchObject({ status: 409, currentStatus: null });
      repo.changeStatus.mockResolvedValueOnce({ result: 'not-found' });
      expect(await fail(service.decide(APP_ID, { decision: 'REJECTED' }, HR_ID))).toMatchObject({ status: 404, code: 'APPLICATION_NOT_FOUND' });
    });
  });

  describe('reEvaluate() (AC-7)', () => {
    it('back to SUBMITTED with the fixed note, by the signed-in HR', async () => {
      await service.reEvaluate(APP_ID, HR_ID);
      expect(repo.changeStatus).toHaveBeenCalledWith(APP_ID, ['EVALUATED', 'EVALUATION_FAILED'], 'SUBMITTED', 'HR yêu cầu đánh giá lại', HR_ID);
    });

    it('status not allowed → 409', async () => {
      repo.changeStatus.mockResolvedValueOnce({ result: 'not-allowed', status: 'SUBMITTED' });
      expect(await fail(service.reEvaluate(APP_ID, HR_ID))).toMatchObject({ status: 409, code: 'STATUS_NOT_ALLOWED', currentStatus: 'SUBMITTED' });
    });
  });
});
