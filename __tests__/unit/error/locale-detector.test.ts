import { vi } from 'vitest';

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
}));

import { LocaleDetector } from '@withwiz/error/core/locale-detector';

describe('LocaleDetector', () => {
  describe('detectClient', () => {
    it('returns ko when window is undefined (SSR fallback)', () => {
      const result = LocaleDetector.detectClient();
      expect(result).toBe('ko');
    });
  });

  describe('detectServer', () => {
    function createMockRequest(options: {
      cookieLocale?: string;
      acceptLanguage?: string;
    }) {
      return {
        cookies: {
          get: (name: string) => {
            if (name === 'locale' && options.cookieLocale) {
              return { value: options.cookieLocale };
            }
            return undefined;
          },
        },
        headers: {
          get: (name: string) => {
            if (name === 'accept-language') {
              return options.acceptLanguage || null;
            }
            return null;
          },
        },
      } as any;
    }

    it('returns locale from cookie when valid', () => {
      const request = createMockRequest({ cookieLocale: 'ko' });
      expect(LocaleDetector.detectServer(request)).toBe('ko');
    });

    it('returns en from cookie when cookie is en', () => {
      const request = createMockRequest({ cookieLocale: 'en' });
      expect(LocaleDetector.detectServer(request)).toBe('en');
    });

    it('returns ja from cookie when cookie is ja', () => {
      const request = createMockRequest({ cookieLocale: 'ja' });
      expect(LocaleDetector.detectServer(request)).toBe('ja');
    });

    it('falls back to accept-language when no cookie', () => {
      const request = createMockRequest({ acceptLanguage: 'en-US,en;q=0.9' });
      expect(LocaleDetector.detectServer(request)).toBe('en');
    });

    it('parses primary language from complex accept-language header', () => {
      const request = createMockRequest({ acceptLanguage: 'ja-JP,ja;q=0.9,en-US;q=0.8' });
      expect(LocaleDetector.detectServer(request)).toBe('ja');
    });

    it('returns ko when no cookie and no accept-language header', () => {
      const request = createMockRequest({});
      expect(LocaleDetector.detectServer(request)).toBe('ko');
    });

    it('returns ko when accept-language has invalid locale', () => {
      const request = createMockRequest({ acceptLanguage: 'fr-FR,fr;q=0.9' });
      expect(LocaleDetector.detectServer(request)).toBe('ko');
    });

    it('ignores invalid cookie locale and falls back to accept-language', () => {
      const request = createMockRequest({ cookieLocale: 'xx', acceptLanguage: 'en-US' });
      expect(LocaleDetector.detectServer(request)).toBe('en');
    });

    it('returns ko when both cookie and accept-language are invalid', () => {
      const request = createMockRequest({ cookieLocale: 'zz', acceptLanguage: 'fr-FR' });
      expect(LocaleDetector.detectServer(request)).toBe('ko');
    });

    it('returns ko when cookies.get throws an error', () => {
      const request = {
        cookies: {
          get: () => { throw new Error('cookie error'); },
        },
        headers: {
          get: () => null,
        },
      } as any;
      expect(LocaleDetector.detectServer(request)).toBe('ko');
    });
  });

  describe('setClientLocale', () => {
    it('does nothing without error when window is undefined', () => {
      expect(() => LocaleDetector.setClientLocale('en')).not.toThrow();
    });
  });

  describe('clearClientLocale', () => {
    it('does nothing without error when window is undefined', () => {
      expect(() => LocaleDetector.clearClientLocale()).not.toThrow();
    });
  });
});
