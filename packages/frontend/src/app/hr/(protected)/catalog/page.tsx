import type { Metadata } from 'next';
import type { IHrCatalogItem } from '@org/shared';
import { ErrorNotice } from '../../../../components/common/ErrorNotice';
import { CatalogManager } from '../../../../components/hr/CatalogManager';
import { getI18n } from '../../../../i18n/server';
import { HrBackendError, hrBackendGet } from '../../../../lib/hr-backend';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hrCatalog.title };
}

/** /hr/catalog — job categories and levels (hr-positions AC-17) */
export default async function HrCatalogPage() {
  const { dict } = await getI18n();
  try {
    const [categories, levels] = await Promise.all([hrBackendGet<IHrCatalogItem[]>('hr/job-categories'), hrBackendGet<IHrCatalogItem[]>('hr/job-levels')]);
    return (
      <section className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">{dict.hrCatalog.title}</h1>
        <CatalogManager kind="category" items={categories} />
        <CatalogManager kind="level" items={levels} />
      </section>
    );
  } catch (error) {
    if (!(error instanceof HrBackendError)) throw error;
    return <ErrorNotice message={dict.hrCatalog.loadError} />;
  }
}
