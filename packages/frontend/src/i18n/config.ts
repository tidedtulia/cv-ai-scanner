export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'vi';

/** Set by the language switcher; URLs stay the same in both languages (IQ1). */
export const LOCALE_COOKIE = 'locale';

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/**
 * Locale of a request (IQ2): the cookie when the visitor picked a language, otherwise the first
 * of vi / en in the browser's Accept-Language preference order, otherwise Vietnamese.
 * e.g. "en-US,en;q=0.9" → en, "vi,en;q=0.8" → vi, "fr,en;q=0.5" → en, "ja" → vi
 */
export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;

  const preferred = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const quality = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { language: tag.trim().toLowerCase().split('-')[0], q: quality ? Number(quality.slice(2)) : 1 };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q)
    .find((entry) => isLocale(entry.language));

  return preferred ? (preferred.language as Locale) : DEFAULT_LOCALE;
}
