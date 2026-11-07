import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, type Locale } from './config';
import { dictionaries, type Dictionary } from './dictionaries';

/** Locale + texts of the current request, for Server Components (see resolveLocale). */
export async function getI18n(): Promise<{ locale: Locale; dict: Dictionary }> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get('accept-language'));
  return { locale, dict: dictionaries[locale] };
}
