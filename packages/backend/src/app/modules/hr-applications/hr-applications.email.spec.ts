import { HttpException, Logger } from '@nestjs/common';
import { HR_APPLICATION_MESSAGES } from '@org/shared';
import { CvStorage } from '../applications/storage/cv-storage';
import { MailSendError, MailService } from '../mail/mail.service';
import { HrApplicationsRepository } from './hr-applications.repository';
import { HrApplicationsService } from './hr-applications.service';

const APP_ID = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const HR_ID = '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11';

const emailRow = (status: string, locale = 'vi', sentAt: Date | null = null) => ({
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  locale,
  status,
  resultEmailSentAt: sentAt,
  position: { title: 'Backend Developer' },
});

const detailRow = (status: string, sentAt: Date | null = null, locale = 'vi') => ({
  id: APP_ID,
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  status,
  createdAt: new Date('2026-11-06T17:30:00Z'),
  cvFileName: 'cv.pdf',
  locale,
  resultEmailSentAt: sentAt,
  position: { code: 'backend-dev', title: 'Backend Developer', minYearsExperience: 2, status: 'OPEN', category: { name: 'Developer' }, level: { code: 'MIDDLE', name: 'Middle' } },
  evaluation: null,
  statusHistory: [],
});

/** Result email of the HR applications (result-email AC-3 → AC-5, AC-7) */
describe('HrApplicationsService result email (result-email)', () => {
  let repo: jest.Mocked<HrApplicationsRepository>;
  let mail: { send: jest.Mock; privacyEmail: string };
  let service: HrApplicationsService;
  let order: string[];
  let logError: jest.SpyInstance;

  const fail = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), ...(error.getResponse() as Record<string, unknown>) };
  };

  beforeEach(() => {
    order = [];
    repo = {
      findDetail: jest.fn().mockResolvedValue(detailRow('ACCEPTED')),
      findOthersByEmail: jest.fn().mockResolvedValue([]),
      changeStatus: jest.fn(async () => (order.push('save'), { result: 'done' as const })),
      findEmailData: jest.fn().mockResolvedValue(emailRow('ACCEPTED')),
      claimEmailSend: jest.fn(async () => (order.push('claim'), true)),
      releaseEmailSend: jest.fn(async () => void order.push('release')),
    } as unknown as jest.Mocked<HrApplicationsRepository>;
    mail = { send: jest.fn(async () => void order.push('send')), privacyEmail: 'privacy@example.com' };
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new HrApplicationsService(repo, {} as CvStorage, mail as unknown as MailService);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('emailPreview() (AC-3)', () => {
    it.each([
      ['EVALUATED', 'vi', 'ACCEPTED', 'Kết quả ứng tuyển: Backend Developer', 'vui mừng thông báo'],
      ['EVALUATION_FAILED', 'vi', 'REJECTED', 'Kết quả ứng tuyển: Backend Developer', 'chưa thể tiếp tục'],
      ['EVALUATED', 'en', 'ACCEPTED', 'Your application: Backend Developer', 'pleased to let you know'],
      ['EVALUATED', 'en', 'REJECTED', 'Your application: Backend Developer', 'will not be moving forward'],
    ])('%s · %s · %s → the template of the application language, to the candidate', async (status, locale, decision, subject, sentence) => {
      repo.findEmailData.mockResolvedValue(emailRow(status, locale) as never);
      const preview = await service.emailPreview(APP_ID, decision);
      expect(preview).toMatchObject({ locale, to: 'an@example.com', subject });
      expect(preview.text).toContain(sentence);
      expect(preview.text).toContain('Nguyễn Văn An');
      expect(preview.text).toContain('privacy@example.com');
      expect(preview.html).toContain('<html');
    });

    it('sends nothing and changes nothing; an unknown language falls back to Vietnamese', async () => {
      repo.findEmailData.mockResolvedValue(emailRow('EVALUATED', 'fr') as never);
      expect((await service.emailPreview(APP_ID, 'ACCEPTED')).locale).toBe('vi');
      expect(mail.send).not.toHaveBeenCalled();
      expect(repo.claimEmailSend).not.toHaveBeenCalled();
      expect(repo.changeStatus).not.toHaveBeenCalled();
    });

    it('shows the real candidate address even when MAIL_REDIRECT_TO diverts the real mail', async () => {
      repo.findEmailData.mockResolvedValue(emailRow('EVALUATED') as never);
      Object.assign(mail, { recipientFor: () => 'me@example.com' });
      expect((await service.emailPreview(APP_ID, 'ACCEPTED')).to).toBe('an@example.com');
    });

    it.each([['SUBMITTED'], ['EVALUATING'], ['REJECTED']])('status %s → 409 STATUS_NOT_ALLOWED with the current status', async (status) => {
      repo.findEmailData.mockResolvedValue(emailRow(status) as never);
      expect(await fail(service.emailPreview(APP_ID, 'ACCEPTED'))).toMatchObject({ status: 409, code: 'STATUS_NOT_ALLOWED', currentStatus: status });
    });

    it('after the decision only the email of that decision can be previewed (for "Gửi lại")', async () => {
      repo.findEmailData.mockResolvedValue(emailRow('ACCEPTED') as never);
      await expect(service.emailPreview(APP_ID, 'ACCEPTED')).resolves.toMatchObject({ subject: 'Kết quả ứng tuyển: Backend Developer' });
      expect(await fail(service.emailPreview(APP_ID, 'REJECTED'))).toMatchObject({ status: 409, code: 'STATUS_NOT_ALLOWED', currentStatus: 'ACCEPTED' });
    });

    it.each([[undefined], ['accepted'], ['SUBMITTED'], [['ACCEPTED', 'REJECTED']], [42]])('decision %p → 400 DECISION_INVALID', async (decision) => {
      expect(await fail(service.emailPreview(APP_ID, decision))).toMatchObject({ status: 400, code: 'DECISION_INVALID' });
      expect(repo.findEmailData).not.toHaveBeenCalled();
    });

    it('unknown application → 404 APPLICATION_NOT_FOUND', async () => {
      repo.findEmailData.mockResolvedValue(null);
      expect(await fail(service.emailPreview(APP_ID, 'ACCEPTED'))).toMatchObject({ status: 404, code: 'APPLICATION_NOT_FOUND' });
    });
  });

  describe('decide() sends the email (AC-4)', () => {
    it('order: save the decision → claim → send; answers emailSent: true with the detail', async () => {
      const result = await service.decide(APP_ID, { decision: 'ACCEPTED' }, HR_ID);
      expect(order).toEqual(['save', 'claim', 'send']);
      expect(result).toMatchObject({ id: APP_ID, emailSent: true });
      expect(mail.send).toHaveBeenCalledTimes(1);
      const [to, email] = mail.send.mock.calls[0];
      expect(to).toBe('an@example.com');
      expect(email.subject).toBe('Kết quả ứng tuyển: Backend Developer');
      expect(email.text).toContain('vui mừng thông báo');
    });

    it('REJECTED in English → the English rejection', async () => {
      repo.findEmailData.mockResolvedValue(emailRow('REJECTED', 'en') as never);
      await service.decide(APP_ID, { decision: 'REJECTED' }, HR_ID);
      expect(mail.send.mock.calls[0][1].subject).toBe('Your application: Backend Developer');
      expect(mail.send.mock.calls[0][1].text).toContain('will not be moving forward');
    });

    it('the HR note never reaches the email', async () => {
      await service.decide(APP_ID, { decision: 'ACCEPTED', note: 'ghi chú nội bộ rất bí mật' }, HR_ID);
      expect(JSON.stringify(mail.send.mock.calls)).not.toContain('bí mật');
    });

    it('SMTP failure: the decision stays saved, the claim is given back, emailSent: false, the error is logged without content', async () => {
      mail.send.mockRejectedValueOnce(new MailSendError('Email could not be sent', 'send-failed'));
      const result = await service.decide(APP_ID, { decision: 'ACCEPTED' }, HR_ID);
      expect(order).toEqual(['save', 'claim', 'release']);
      expect(result).toMatchObject({ id: APP_ID, emailSent: false });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('was not sent'));
      expect(JSON.stringify(logError.mock.calls)).not.toMatch(/an@example\.com|vui mừng/);
    });

    it('email not configured: same as a failed send', async () => {
      mail.send.mockRejectedValueOnce(new MailSendError('Email is not configured', 'not-configured'));
      await expect(service.decide(APP_ID, { decision: 'REJECTED' }, HR_ID)).resolves.toMatchObject({ emailSent: false });
      expect(repo.releaseEmailSend).toHaveBeenCalledWith(APP_ID);
    });

    it('a problem while rendering / reading is also contained: the decision stays, emailSent: false', async () => {
      repo.findEmailData.mockRejectedValueOnce(new Error('db hiccup'));
      await expect(service.decide(APP_ID, { decision: 'ACCEPTED' }, HR_ID)).resolves.toMatchObject({ emailSent: false });
      expect(repo.releaseEmailSend).toHaveBeenCalled();
    });

    it('no email when the decision itself is rejected (409 / 400)', async () => {
      repo.changeStatus.mockResolvedValueOnce({ result: 'not-allowed', status: 'ACCEPTED' });
      expect(await fail(service.decide(APP_ID, { decision: 'REJECTED' }, HR_ID))).toMatchObject({ status: 409 });
      expect(await fail(service.decide(APP_ID, { decision: 'nope' }, HR_ID))).toMatchObject({ status: 400 });
      expect(repo.claimEmailSend).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('re-evaluate sends no email', async () => {
      await service.reEvaluate(APP_ID, HR_ID);
      expect(mail.send).not.toHaveBeenCalled();
      expect(repo.claimEmailSend).not.toHaveBeenCalled();
    });
  });

  describe('resendEmail() (AC-5)', () => {
    it('sends the email of the current decision and answers emailSent: true', async () => {
      repo.findEmailData.mockResolvedValue(emailRow('REJECTED', 'en') as never);
      const result = await service.resendEmail(APP_ID);
      expect(order).toEqual(['claim', 'send']);
      expect(result).toMatchObject({ id: APP_ID, emailSent: true });
      expect(mail.send.mock.calls[0][1].text).toContain('will not be moving forward');
    });

    it('send fails → 502 EMAIL_SEND_FAILED and the claim is given back (can be pressed again)', async () => {
      mail.send.mockRejectedValueOnce(new MailSendError('x', 'send-failed'));
      expect(await fail(service.resendEmail(APP_ID))).toMatchObject({ status: 502, code: 'EMAIL_SEND_FAILED', message: HR_APPLICATION_MESSAGES.EMAIL_SEND_FAILED });
      expect(order).toEqual(['claim', 'release']);
    });

    it('already sent → 409 EMAIL_ALREADY_SENT, nothing is sent or claimed', async () => {
      repo.findEmailData.mockResolvedValue(emailRow('ACCEPTED', 'vi', new Date('2026-11-07T10:00:00Z')) as never);
      expect(await fail(service.resendEmail(APP_ID))).toMatchObject({ status: 409, code: 'EMAIL_ALREADY_SENT' });
      expect(repo.claimEmailSend).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('two presses at once: the one that loses the claim gets 409 EMAIL_ALREADY_SENT and sends nothing', async () => {
      repo.claimEmailSend.mockResolvedValueOnce(false);
      expect(await fail(service.resendEmail(APP_ID))).toMatchObject({ status: 409, code: 'EMAIL_ALREADY_SENT' });
      expect(mail.send).not.toHaveBeenCalled();
      expect(repo.releaseEmailSend).not.toHaveBeenCalled();
    });

    it.each([['SUBMITTED'], ['EVALUATING'], ['EVALUATED'], ['EVALUATION_FAILED']])('status %s (no decision yet) → 409 STATUS_NOT_ALLOWED', async (status) => {
      repo.findEmailData.mockResolvedValue(emailRow(status) as never);
      expect(await fail(service.resendEmail(APP_ID))).toMatchObject({ status: 409, code: 'STATUS_NOT_ALLOWED', currentStatus: status });
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('unknown application → 404 APPLICATION_NOT_FOUND', async () => {
      repo.findEmailData.mockResolvedValue(null);
      expect(await fail(service.resendEmail(APP_ID))).toMatchObject({ status: 404, code: 'APPLICATION_NOT_FOUND' });
    });
  });

  describe('email state in the data for the UI (AC-7)', () => {
    it.each([
      ['ACCEPTED', null, true],
      ['REJECTED', null, true],
      ['ACCEPTED', new Date('2026-11-07T10:00:00Z'), false],
      ['EVALUATED', null, false],
      ['SUBMITTED', null, false],
    ])('detail: %s, sent at %p → canResendEmail %s', async (status, sentAt, can) => {
      repo.findDetail.mockResolvedValue(detailRow(status, sentAt, 'en') as never);
      const detail = await service.detail(APP_ID);
      expect(detail).toMatchObject({ locale: 'en', canResendEmail: can, resultEmailSentAt: sentAt ? sentAt.toISOString() : null });
    });

    it.each([
      ['ACCEPTED', null, true],
      ['REJECTED', new Date(), false],
      ['EVALUATED', null, false],
    ])('list: %s, sent at %p → emailPending %s', async (status, sentAt, pending) => {
      (repo as unknown as { listPage: jest.Mock }).listPage = jest.fn().mockResolvedValue([
        { id: 'a1', full_name: 'A', email: 'a@x.co', status, created_at: new Date(), position_code: 'p', position_title: 'P', category_name: 'C', level_name: 'L', overall_score: null, recommendation: null, result_email_sent_at: sentAt },
      ]);
      (repo as unknown as { countByStatus: jest.Mock }).countByStatus = jest.fn().mockResolvedValue({});
      expect((await service.list({ tab: 'all' })).items[0].emailPending).toBe(pending);
    });
  });
});
