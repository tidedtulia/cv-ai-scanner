import type { Metadata } from 'next';
import { SITE_CONFIG } from '../../config/site';
import { format } from '../../i18n/format';
import { getI18n } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.privacy.title };
}

/** Needed for the consent checkbox (FQ2) and to publish the Google OAuth app later. */
export default async function PrivacyPage() {
  const { dict } = await getI18n();
  const values = {
    months: SITE_CONFIG.cvRetentionMonths,
    email: SITE_CONFIG.privacyContactEmail,
    date: SITE_CONFIG.privacyUpdatedAt,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">{dict.privacy.title}</h1>
      <p className="mt-1 text-xs text-gray-500">{format(dict.privacy.updated, values)}</p>
      <p className="mt-6 text-sm text-gray-700">{dict.privacy.intro}</p>
      {dict.privacy.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-base font-semibold text-gray-900">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-gray-700">
              {format(paragraph, values)}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
