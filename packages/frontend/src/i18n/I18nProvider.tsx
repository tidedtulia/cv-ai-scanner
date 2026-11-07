'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './config';
import { dictionaries, type Dictionary } from './dictionaries';

interface I18nValue {
  locale: Locale;
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Gives Client Components the locale the root layout resolved on the server. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict: dictionaries[locale] }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return value;
}
