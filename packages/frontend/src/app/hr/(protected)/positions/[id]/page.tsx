import type { Metadata } from 'next';
import Link from 'next/link';
import type { IHrCatalogItem, IHrPositionDetail } from '@org/shared';
import { ErrorNotice } from '../../../../../components/common/ErrorNotice';
import { CriteriaManager } from '../../../../../components/hr/CriteriaManager';
import { PositionActions } from '../../../../../components/hr/PositionActions';
import { PositionForm } from '../../../../../components/hr/PositionForm';
import { PositionStatusBadge } from '../../../../../components/hr/PositionStatusBadge';
import { format } from '../../../../../i18n/format';
import { getI18n } from '../../../../../i18n/server';
import { HrBackendError, hrBackendGet } from '../../../../../lib/hr-backend';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hrPositions.title };
}

/** /hr/positions/[id] — job details, status actions and criteria (hr-positions AC-14 → AC-16, AC-18) */
export default async function EditPositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dict } = await getI18n();
  const t = dict.hrPositions;
  const back = (
    <Link href="/hr/positions" className="text-sm text-blue-700 hover:underline">
      {t.back}
    </Link>
  );

  let job: IHrPositionDetail;
  let categories: IHrCatalogItem[];
  let levels: IHrCatalogItem[];
  try {
    [job, categories, levels] = await Promise.all([
      hrBackendGet<IHrPositionDetail>(`hr/positions/${id}`),
      hrBackendGet<IHrCatalogItem[]>('hr/job-categories'),
      hrBackendGet<IHrCatalogItem[]>('hr/job-levels'),
    ]);
  } catch (error) {
    if (!(error instanceof HrBackendError)) throw error;
    const missing = error.status === 404 || error.status === 400;
    return (
      <section className="space-y-4">
        {back}
        {missing ? <p className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-700">{t.notFound}</p> : <ErrorNotice message={t.loadError} />}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {back}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
        <PositionStatusBadge status={job.status} dict={dict} />
      </header>
      {job.status === 'DRAFT' && <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{t.form.draftHint}</p>}
      {job.applicationCount > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{format(t.form.warning, { n: job.applicationCount })}</p>}

      <PositionActions job={{ id: job.id, code: job.code, title: job.title, status: job.status, applicationCount: job.applicationCount }} />
      <PositionForm categories={categories} levels={levels} job={job} />
      <CriteriaManager positionId={job.id} criteria={job.criteria} applicationCount={job.applicationCount} />
    </section>
  );
}
