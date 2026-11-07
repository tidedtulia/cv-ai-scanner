import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  HR_ACTIONABLE_STATUSES,
  HR_APPLICATION_MESSAGES,
  HR_APPLICATION_TAB_KEYS,
  HR_APPLICATION_TABS,
  HR_APPLICATIONS_PAGE_SIZE,
  HR_DECIDED_STATUSES,
  HR_DECISION_NOTE_MAX_LENGTH,
  HR_DEFAULT_APPLICATION_TAB,
  HR_RE_EVALUATE_NOTE,
  HR_SEARCH_MAX_LENGTH,
  normalizeApplicationLocale,
  type ApplicationStatus,
  type HrApplicationMessageCode,
  type HrApplicationSort,
  type HrApplicationTab,
  type HrDecision,
  type ICriterionScore,
  type IHrApplicationDetail,
  type IHrApplicationFilters,
  type IHrApplicationListResponse,
  type IHrDecisionResponse,
  type IHrEmailPreview,
  type Recommendation,
} from '@org/shared';
import { apiException } from '../../common/api-error';
import { CvStorage } from '../applications/storage/cv-storage';
import { MailService } from '../mail/mail.service';
import { renderResultEmail } from '../mail/mail-templates';
import { HrApplicationsRepository, type HrListFilters } from './hr-applications.repository';

const error = (status: HttpStatus, code: HrApplicationMessageCode) => apiException(status, code, HR_APPLICATION_MESSAGES[code]);
const RECOMMENDATIONS: readonly Recommendation[] = ['RECOMMENDED', 'CONSIDER', 'NOT_RECOMMENDED'];
const SORTS: readonly HrApplicationSort[] = ['score', 'newest'];
const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const toIso = (date: Date) => date.toISOString();
const asStrings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

export interface CvFile {
  content: Buffer;
  fileName: string;
}

/** HR side of the applications (hr-applications AC-1 → AC-8); every route is behind HrAuthGuard */
@Injectable()
export class HrApplicationsService {
  private readonly logger = new Logger(HrApplicationsService.name);

  constructor(
    private readonly repo: HrApplicationsRepository,
    private readonly storage: CvStorage,
    private readonly mail: MailService,
  ) {}

  /** AC-1, AC-2 */
  async list(query: Record<string, unknown>): Promise<IHrApplicationListResponse> {
    const { tab, sort, page, filters } = this.parseQuery(query);
    const statuses = HR_APPLICATION_TABS[tab];
    const [rows, perStatus] = await Promise.all([
      this.repo.listPage(filters, statuses, sort, (page - 1) * HR_APPLICATIONS_PAGE_SIZE, HR_APPLICATIONS_PAGE_SIZE),
      this.repo.countByStatus(filters),
    ]);
    const count = (key: HrApplicationTab) => HR_APPLICATION_TABS[key].reduce((sum, status) => sum + (perStatus[status] ?? 0), 0);
    const counts = Object.fromEntries(HR_APPLICATION_TAB_KEYS.map((key) => [key, count(key)])) as Record<HrApplicationTab, number>;

    return {
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        status: row.status,
        createdAt: toIso(row.created_at),
        position: { code: row.position_code, title: row.position_title, category: row.category_name, level: row.level_name },
        overallScore: toNumber(row.overall_score),
        recommendation: row.recommendation,
        emailPending: HR_DECIDED_STATUSES.includes(row.status) && !row.result_email_sent_at,
      })),
      total: counts[tab],
      page,
      pageSize: HR_APPLICATIONS_PAGE_SIZE,
      counts,
      tab,
      sort,
    };
  }

  /** AC-3 */
  async filters(): Promise<IHrApplicationFilters> {
    const [positions, categories, levels] = await this.repo.filterOptions();
    return { positions, categories, levels };
  }

  /** AC-4 */
  async detail(id: string): Promise<IHrApplicationDetail> {
    const app = await this.repo.findDetail(id);
    if (!app) throw error(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    const others = await this.repo.findOthersByEmail(app.email, app.id);
    const evaluation = app.evaluation;
    const actionable = HR_ACTIONABLE_STATUSES.includes(app.status);

    return {
      id: app.id,
      fullName: app.fullName,
      email: app.email,
      status: app.status,
      createdAt: toIso(app.createdAt),
      cvFileName: app.cvFileName,
      position: {
        code: app.position.code,
        title: app.position.title,
        category: app.position.category.name,
        level: app.position.level,
        minYearsExperience: app.position.minYearsExperience,
        status: app.position.status,
      },
      evaluation: evaluation && {
        overallScore: Number(evaluation.overallScore),
        recommendation: evaluation.recommendation,
        summary: evaluation.summary,
        strengths: asStrings(evaluation.strengths),
        weaknesses: asStrings(evaluation.weaknesses),
        criteriaScores: (Array.isArray(evaluation.criteriaScores) ? evaluation.criteriaScores : []) as unknown as ICriterionScore[],
        estimatedYearsExperience: toNumber(evaluation.estimatedYearsExperience),
        estimatedLevel: evaluation.estimatedLevel,
        model: evaluation.aiModel,
        promptVersion: evaluation.promptVersion,
        evaluatedAt: toIso(evaluation.updatedAt),
      },
      history: app.statusHistory.map((row) => ({
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        note: row.note,
        createdAt: toIso(row.createdAt),
        changedBy: row.changedBy?.name ?? null,
      })),
      otherApplications: others.map((other) => ({
        id: other.id,
        positionTitle: other.position.title,
        status: other.status,
        createdAt: toIso(other.createdAt),
        overallScore: toNumber(other.evaluation?.overallScore),
      })),
      canDecide: actionable,
      canReEvaluate: actionable,
      locale: normalizeApplicationLocale(app.locale),
      resultEmailSentAt: app.resultEmailSentAt ? toIso(app.resultEmailSentAt) : null,
      canResendEmail: HR_DECIDED_STATUSES.includes(app.status) && !app.resultEmailSentAt,
    };
  }

  /** AC-5 */
  async cv(id: string): Promise<CvFile> {
    const app = await this.repo.findCvFile(id);
    if (!app) throw error(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    let content: Buffer | null;
    try {
      content = await this.storage.download(app.cvDriveFileId);
    } catch (cause) {
      this.logger.error(`CV download failed for application ${id}`, (cause as Error).stack);
      throw error(HttpStatus.BAD_GATEWAY, 'CV_UNAVAILABLE');
    }
    if (!content) throw error(HttpStatus.NOT_FOUND, 'CV_NOT_FOUND');
    return { content, fileName: app.cvFileName };
  }

  /** AC-3 (result-email): the email a decision sends (or sent), nothing is sent */
  async emailPreview(id: string, decisionParam: unknown): Promise<IHrEmailPreview> {
    if (decisionParam !== 'ACCEPTED' && decisionParam !== 'REJECTED') throw error(HttpStatus.BAD_REQUEST, 'DECISION_INVALID');
    const data = await this.repo.findEmailData(id);
    if (!data) throw error(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    // Before the decision any of the two can be previewed; after it, only the email of that decision ("Gửi lại")
    if (!HR_ACTIONABLE_STATUSES.includes(data.status) && data.status !== decisionParam) throw this.notAllowed(data.status);
    const locale = normalizeApplicationLocale(data.locale);
    const email = renderResultEmail({
      locale,
      decision: decisionParam,
      fullName: data.fullName,
      positionTitle: data.position.title,
      privacyEmail: this.mail.privacyEmail,
    });
    return { locale, to: data.email, ...email };
  }

  /** AC-6, and AC-4 (result-email): save the decision, then send the email; a failed send keeps the decision */
  async decide(id: string, body: unknown, hrUserId: string): Promise<IHrDecisionResponse> {
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const decision = input['decision'];
    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') throw error(HttpStatus.BAD_REQUEST, 'DECISION_INVALID');
    const rawNote = input['note'];
    if (rawNote !== undefined && rawNote !== null && typeof rawNote !== 'string') throw error(HttpStatus.BAD_REQUEST, 'NOTE_TOO_LONG');
    const note = typeof rawNote === 'string' ? rawNote.trim() : '';
    if (note.length > HR_DECISION_NOTE_MAX_LENGTH) throw error(HttpStatus.BAD_REQUEST, 'NOTE_TOO_LONG');

    await this.changeStatus(id, decision, note || null, hrUserId);
    const emailSent = (await this.deliverResultEmail(id)) === 'sent';
    return { ...(await this.detail(id)), emailSent };
  }

  /** AC-5 (result-email) */
  async resendEmail(id: string): Promise<IHrDecisionResponse> {
    const data = await this.repo.findEmailData(id);
    if (!data) throw error(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    if (!HR_DECIDED_STATUSES.includes(data.status)) throw this.notAllowed(data.status);
    if (data.resultEmailSentAt) throw error(HttpStatus.CONFLICT, 'EMAIL_ALREADY_SENT');

    const outcome = await this.deliverResultEmail(id);
    if (outcome === 'taken') throw error(HttpStatus.CONFLICT, 'EMAIL_ALREADY_SENT');
    if (outcome === 'failed') throw error(HttpStatus.BAD_GATEWAY, 'EMAIL_SEND_FAILED');
    return { ...(await this.detail(id)), emailSent: true };
  }

  /**
   * Claim → send → (give the claim back on failure). Never throws for a send problem: the caller decides what it means.
   * 'taken' = another request already sent (or is sending) it.
   */
  private async deliverResultEmail(id: string): Promise<'sent' | 'failed' | 'taken'> {
    if (!(await this.repo.claimEmailSend(id, HR_DECIDED_STATUSES))) return 'taken';
    try {
      const data = await this.repo.findEmailData(id);
      if (!data) throw new Error('application disappeared');
      const email = renderResultEmail({
        locale: normalizeApplicationLocale(data.locale),
        decision: data.status as HrDecision,
        fullName: data.fullName,
        positionTitle: data.position.title,
        privacyEmail: this.mail.privacyEmail,
      });
      await this.mail.send(data.email, email);
      return 'sent';
    } catch (cause) {
      this.logger.error(`Result email of application ${id} was not sent: ${(cause as Error).message}`);
      await this.repo.releaseEmailSend(id).catch((releaseError: Error) =>
        this.logger.error(`Could not release the email claim of application ${id}`, releaseError.stack),
      );
      return 'failed';
    }
  }

  private notAllowed(status: ApplicationStatus | undefined) {
    return apiException(HttpStatus.CONFLICT, 'STATUS_NOT_ALLOWED', HR_APPLICATION_MESSAGES.STATUS_NOT_ALLOWED, { currentStatus: status ?? null });
  }

  /** AC-7 */
  async reEvaluate(id: string, hrUserId: string): Promise<IHrApplicationDetail> {
    await this.changeStatus(id, 'SUBMITTED', HR_RE_EVALUATE_NOTE, hrUserId);
    return this.detail(id);
  }

  private async changeStatus(id: string, to: ApplicationStatus, note: string | null, hrUserId: string) {
    const outcome = await this.repo.changeStatus(id, HR_ACTIONABLE_STATUSES, to, note, hrUserId);
    if (outcome.result === 'not-found') throw error(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    if (outcome.result === 'not-allowed') throw this.notAllowed(outcome.status);
  }

  /** AC-2: unknown values / repeated parameters → 400 INVALID_QUERY */
  private parseQuery(query: Record<string, unknown>) {
    const invalid = () => error(HttpStatus.BAD_REQUEST, 'INVALID_QUERY');
    const text = (name: string): string | undefined => {
      const value = query[name];
      if (value === undefined) return undefined;
      if (typeof value !== 'string') throw invalid();
      return value.trim() || undefined;
    };

    const tab = (text('tab') ?? HR_DEFAULT_APPLICATION_TAB) as HrApplicationTab;
    if (!HR_APPLICATION_TAB_KEYS.includes(tab)) throw invalid();
    const sort = (text('sort') ?? (tab === 'to-decide' ? 'score' : 'newest')) as HrApplicationSort;
    if (!SORTS.includes(sort)) throw invalid();
    const pageText = text('page') ?? '1';
    if (!/^[1-9]\d{0,5}$/.test(pageText)) throw invalid();
    const recommendation = text('recommendation') as Recommendation | undefined;
    if (recommendation && !RECOMMENDATIONS.includes(recommendation)) throw invalid();
    const q = text('q');
    if (q && q.length > HR_SEARCH_MAX_LENGTH) throw invalid();

    const filters: HrListFilters = { position: text('position'), category: text('category'), level: text('level'), recommendation, q };
    return { tab, sort, page: Number(pageText), filters };
  }
}

