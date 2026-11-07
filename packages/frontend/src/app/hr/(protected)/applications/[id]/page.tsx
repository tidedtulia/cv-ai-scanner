import type { Metadata } from 'next';
import Link from 'next/link';
import type { IHrApplicationDetail } from '@org/shared';
import { ErrorNotice } from '../../../../../components/common/ErrorNotice';
import { DecisionActions } from '../../../../../components/hr/DecisionActions';
import { ResultEmailStatus } from '../../../../../components/hr/ResultEmailStatus';
import { RecommendationBadge, StatusBadge } from '../../../../../components/hr/StatusBadges';
import { format } from '../../../../../i18n/format';
import { formatDate, formatDateTime, formatScore } from '../../../../../i18n/format-date';
import { getI18n } from '../../../../../i18n/server';
import { HrBackendError, hrBackendGet } from '../../../../../lib/hr-backend';
import { backToListHref } from '../../../../../lib/hr-list-url';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hrApplications.title };
}

/** The last error note of the history, shown when the AI evaluation failed */
const lastFailure = (detail: IHrApplicationDetail) => [...detail.history].reverse().find((row) => row.toStatus === 'EVALUATION_FAILED')?.note ?? '';

/** /hr/applications/[id] — AI result next to the CV, decision and re-evaluation (hr-applications AC-13 → AC-18) */
export default async function HrApplicationDetailPage({ params, searchParams }: Props) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const { dict } = await getI18n();
  const t = dict.hrApplications;
  const back = (
    <Link href={backToListHref(Array.isArray(from) ? from[0] : from)} className="text-sm text-blue-700 hover:underline">
      {t.detail.back}
    </Link>
  );

  let detail: IHrApplicationDetail;
  try {
    detail = await hrBackendGet<IHrApplicationDetail>(`hr/applications/${id}`);
  } catch (error) {
    if (!(error instanceof HrBackendError)) throw error;
    const notFound = error.status === 404 || error.status === 400;
    return (
      <section className="space-y-4">
        {back}
        {notFound ? <p className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-700">{t.detail.notFound}</p> : <ErrorNotice message={t.loadError} />}
      </section>
    );
  }

  const ev = detail.evaluation;
  const reEvaluating = ev && detail.status === 'SUBMITTED';
  const years = (n: number) => (n === 0 ? t.detail.noExperience : format(t.detail.requiredYears, { n }));

  return (
    <section className="space-y-5">
      {back}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{detail.fullName}</h1>
        <p className="text-sm text-gray-600">
          {detail.email} · {detail.position.title} ({detail.position.category} · {detail.position.level.name}) · {format(t.detail.submittedOn, { date: formatDate(detail.createdAt) })}
        </p>
        <StatusBadge status={detail.status} dict={dict} />
      </header>

      <DecisionActions application={{ id: detail.id, fullName: detail.fullName, email: detail.email, canDecide: detail.canDecide, canReEvaluate: detail.canReEvaluate, positionTitle: detail.position.title }} />
      <ResultEmailStatus application={{ id: detail.id, fullName: detail.fullName, email: detail.email, status: detail.status, resultEmailSentAt: detail.resultEmailSentAt, canResendEmail: detail.canResendEmail }} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900">{t.detail.aiTitle}</h2>
          {reEvaluating && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.detail.outdated}</p>}
          {!ev && (detail.status === 'SUBMITTED' || detail.status === 'EVALUATING') && <p className="text-sm text-gray-700">{t.detail.pendingAi}</p>}
          {!ev && detail.status === 'EVALUATION_FAILED' && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p>{format(t.detail.failedAi, { reason: lastFailure(detail) })}</p>
              <p className="mt-1">{t.detail.failedHint}</p>
            </div>
          )}
          {ev && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-600">{t.detail.overall}</span>
                <strong className="text-3xl text-gray-900">{formatScore(ev.overallScore)}</strong>
                <RecommendationBadge value={ev.recommendation} dict={dict} />
              </div>
              <p className="text-sm text-gray-700">
                {format(t.detail.required, { level: detail.position.level.name, years: years(detail.position.minYearsExperience) })}
                <br />
                {format(t.detail.estimated, {
                  level: ev.estimatedLevel?.name ?? t.detail.unknown,
                  years: ev.estimatedYearsExperience === null ? t.detail.unknown : format(t.detail.estimatedYears, { n: ev.estimatedYearsExperience }),
                })}
              </p>
              <p className="text-sm text-gray-800">{ev.summary}</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <caption className="px-3 py-2 text-left text-sm font-semibold text-gray-800">{t.detail.criteriaTitle}</caption>
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">{t.detail.criterion}</th>
                      <th scope="col" className="px-3 py-2">{t.detail.type}</th>
                      <th scope="col" className="px-3 py-2">{t.detail.weight}</th>
                      <th scope="col" className="px-3 py-2">{t.detail.score}</th>
                      <th scope="col" className="px-3 py-2">{t.detail.reasoning}</th>
                      <th scope="col" className="px-3 py-2">{t.detail.evidence}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 align-top">
                    {ev.criteriaScores.map((c) => (
                      <tr key={c.criterion_id}>
                        <td className="px-3 py-2 font-medium">
                          {c.name}
                          {c.is_required && <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white">{t.detail.required_badge}</span>}
                        </td>
                        <td className="px-3 py-2">{t.criterionType[c.type]}</td>
                        <td className="px-3 py-2">{c.weight}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{c.score}/10</td>
                        <td className="px-3 py-2">{c.reasoning}</td>
                        <td className="px-3 py-2 text-gray-600">{c.evidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{t.detail.strengths}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">{ev.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{t.detail.weaknesses}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">{ev.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              </div>
              <p className="text-xs text-gray-500">{format(t.detail.evaluatedBy, { model: ev.model, version: ev.promptVersion, date: formatDateTime(ev.evaluatedAt) })}</p>
            </>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t.detail.cvTitle}</h2>
          <div className="flex gap-4 text-sm">
            <a href={`/api/hr/applications/${detail.id}/cv`} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{t.detail.openCv}</a>
            <a href={`/api/hr/applications/${detail.id}/cv`} download={detail.cvFileName} className="text-blue-700 hover:underline">{t.detail.downloadCv}</a>
          </div>
          <iframe src={`/api/hr/applications/${detail.id}/cv`} title={format(t.detail.cvFrame, { name: detail.fullName })} className="h-[80vh] w-full rounded-lg border border-gray-200 bg-white" />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">{t.detail.historyTitle}</h2>
        <ol className="mt-2 space-y-2 border-l-2 border-gray-200 pl-4 text-sm">
          {detail.history.map((row, index) => (
            <li key={index}>
              <span className="text-gray-500">{formatDateTime(row.createdAt)}</span> · {row.fromStatus ? t.status[row.fromStatus] : '—'} → <strong>{t.status[row.toStatus]}</strong> · {row.changedBy ?? t.detail.system}
              {row.note && <div className="text-gray-700">{row.note}</div>}
            </li>
          ))}
        </ol>
      </div>

      {detail.otherApplications.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t.detail.othersTitle}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {detail.otherApplications.map((other) => (
              <li key={other.id}>
                <Link href={`/hr/applications/${other.id}`} className="text-blue-700 hover:underline">{other.positionTitle}</Link> · {formatDate(other.createdAt)} · {t.status[other.status]} · {other.overallScore === null ? t.noScore : formatScore(other.overallScore)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
