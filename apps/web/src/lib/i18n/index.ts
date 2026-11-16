'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { zh, type Translations } from './zh';
import { en } from './en';
import React from 'react';

export type Locale = 'zh' | 'en';

const translations: Record<Locale, Translations> = { zh, en };

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  t: zh,
  setLocale: () => {},
});

const STORAGE_KEY = 'bookmark-hub-locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    const preferred = navigator.languages?.[0] || navigator.language || '';
    const initial: Locale = saved === 'zh' || saved === 'en'
      ? saved
      : /^zh(?:-|$)/i.test(preferred) ? 'zh' : 'en';
    // Restore the explicit choice or use the browser's first preferred language.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(initial);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value: I18nContextValue = {
    locale,
    t: translations[locale],
    setLocale,
  };

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Keep server errors in the selected UI language without changing user content. */
export function localizedError(locale: Locale, error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : error;
  if (typeof message !== 'string' || !message.trim()) return fallback;
  if (locale === 'en' && /[\u3400-\u9fff]/.test(message)) return fallback;
  if (locale === 'zh' && /[A-Za-z]/.test(message) && !/[\u3400-\u9fff]/.test(message) && /[\u3400-\u9fff]/.test(fallback)) return fallback;
  return message;
}

export { zh, en };
export type { Translations };
