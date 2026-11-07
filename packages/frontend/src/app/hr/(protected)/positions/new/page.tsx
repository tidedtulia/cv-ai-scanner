import type { Metadata } from 'next';
import Link from 'next/link';
import type { IHrCatalogItem } from '@org/shared';
import { ErrorNotice } from '../../../../../components/common/ErrorNotice';
import { PositionForm } from '../../../../../components/hr/PositionForm';
import { getI18n } from '../../../../../i18n/server';
import { HrBackendError, hrBackendGet } from '../../../../../lib/hr-backend';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hrPositions.form.createTitle };
}

/** /hr/positions/new (hr-positions AC-14) */
export default async function NewPositionPage() {
  const { dict } = await getI18n();
  const t = dict.hrPositions;
  try {
    const [categories, levels] = await Promise.all([hrBackendGet<IHrCatalogItem[]>('hr/job-categories'), hrBackendGet<IHrCatalogItem[]>('hr/job-levels')]);
    return (
      <section className="space-y-4">
        <Link href="/hr/positions" className="text-sm text-blue-700 hover:underline">
          {t.back}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t.form.createTitle}</h1>
        <PositionForm categories={categories} levels={levels} />
      </section>
    );
  } catch (error) {
    if (!(error instanceof HrBackendError)) throw error;
    return <ErrorNotice message={t.loadError} />;
  }
}
