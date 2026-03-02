/**
 * 로케일 감지 유틸리티
 * 클라이언트와 서버에서 사용자 언어를 감지
 */

import { NextRequest } from 'next/server';
import type { TLocale } from '@withwiz/error/messages/types';

/**
 * 로케일 감지기
 */
export class LocaleDetector {
  /**
   * 클라이언트 측 로케일 감지
   * 우선순위: localStorage > cookie > navigator.language > 기본값
   *
   * @returns 감지된 로케일
   */
  static detectClient(): TLocale {
    if (typeof window === 'undefined') {
      return 'ko'; // SSR fallback
    }

    try {
      // 1. localStorage 확인
      const stored = localStorage.getItem('locale');
      if (stored && this.isValidLocale(stored)) {
        return stored as TLocale;
      }

      // 2. Cookie 확인
      const cookieMatch = document.cookie
        .split('; ')
        .find(row => row.startsWith('locale='));

      if (cookieMatch) {
        const locale = cookieMatch.split('=')[1];
        if (this.isValidLocale(locale)) {
          return locale as TLocale;
        }
      }

      // 3. 브라우저 언어 확인
      const browserLang = navigator.language.split('-')[0].toLowerCase();
      if (this.isValidLocale(browserLang)) {
        return browserLang as TLocale;
      }

      // 4. 기본값
      return 'ko';
    } catch (error) {
      // 에러 발생 시 기본값 반환
      return 'ko';
    }
  }

  /**
   * 서버 측 로케일 감지
   * 우선순위: Cookie > Accept-Language 헤더 > 기본값
   *
   * @param request - NextRequest 객체
   * @returns 감지된 로케일
   */
  static detectServer(request: NextRequest): TLocale {
    try {
      // 1. Cookie 우선 확인
      const cookieLocale = request.cookies.get('locale')?.value;
      if (cookieLocale && this.isValidLocale(cookieLocale)) {
        return cookieLocale as TLocale;
      }

      // 2. Accept-Language 헤더
      const acceptLanguage = request.headers.get('accept-language');
      if (acceptLanguage) {
        // "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7" 형식 파싱
        const primaryLang = acceptLanguage
          .split(',')[0]
          .split('-')[0]
          .split(';')[0]
          .toLowerCase()
          .trim();

        if (this.isValidLocale(primaryLang)) {
          return primaryLang as TLocale;
        }
      }

      // 3. 기본값
      return 'ko';
    } catch (error) {
      // 에러 발생 시 기본값 반환
      return 'ko';
    }
  }

  /**
   * 유효한 로케일인지 확인
   *
   * @param locale - 확인할 로케일
   * @returns 유효 여부
   */
  private static isValidLocale(locale: string): boolean {
    return ['ko', 'en', 'ja'].includes(locale.toLowerCase());
  }

  /**
   * 클라이언트에서 로케일 설정 (localStorage + cookie)
   *
   * @param locale - 설정할 로케일
   */
  static setClientLocale(locale: TLocale): void {
    if (typeof window === 'undefined') return;

    try {
      // localStorage 설정
      localStorage.setItem('locale', locale);

      // Cookie 설정 (1년 유효)
      const expiresDate = new Date();
      expiresDate.setFullYear(expiresDate.getFullYear() + 1);
      document.cookie = `locale=${locale}; expires=${expiresDate.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {
      console.error('Failed to set locale:', error);
    }
  }

  /**
   * 클라이언트에서 로케일 제거
   */
  static clearClientLocale(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('locale');
      document.cookie = 'locale=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
    } catch (error) {
      console.error('Failed to clear locale:', error);
    }
  }
}

export default LocaleDetector;
