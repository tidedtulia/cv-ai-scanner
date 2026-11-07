'use client';

import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_COOKIE, type Locale } from '../../i18n/config';
import { useI18n } from '../../i18n/I18nProvider';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const LABELS: Record<Locale, string> = { vi: 'VI', en: 'EN' };

/** Stores the choice in a cookie and re-renders the Server Components; form state is kept. */
export function LanguageSwitcher() {
  const { locale, dict } = useI18n();
  const router = useRouter();

  const change = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    router.refresh();
  };

  return (
    <div role="group" aria-label={dict.nav.language} className="flex overflow-hidden rounded-md border border-gray-300">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          onClick={() => change(option)}
          className={`px-2 py-1 text-xs font-semibold ${
            option === locale ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
