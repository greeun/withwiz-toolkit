// 국제화 관련 타입 정의
export type Locale = 'en' | 'ko' | 'ja';

export interface II18nConfig {
  defaultLocale: Locale;
  locales: Locale[];
  localeNames: Record<Locale, string>;
}

declare global {
  interface Window {
    __NEXT_LOCALE__: Locale;
  }
}

