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

/**
 * Client-side tests with browser environment mocks
 * Tests that require window, localStorage, document, and navigator
 */
describe('LocaleDetector (client-side)', () => {
  let originalWindow: typeof globalThis.window;
  let mockLocalStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    originalWindow = global.window;

    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    // Set up window-like environment
    Object.defineProperty(global, 'window', {
      value: { localStorage: mockLocalStorage, document: global.document },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe('detectClient with browser environment', () => {
    it('returns locale from localStorage when valid', () => {
      mockLocalStorage.getItem.mockReturnValue('en');
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ko-KR' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('en');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('locale');
    });

    it('returns ja from localStorage when valid', () => {
      mockLocalStorage.getItem.mockReturnValue('ja');
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ko-KR' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('ja');
    });

    it('falls back to cookie when localStorage has invalid locale', () => {
      mockLocalStorage.getItem.mockReturnValue('xx');
      Object.defineProperty(global, 'document', {
        value: { cookie: 'locale=en; other=value' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ko-KR' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('en');
    });

    it('falls back to cookie when localStorage returns null', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      Object.defineProperty(global, 'document', {
        value: { cookie: 'locale=ja; other=value' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ko-KR' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('ja');
    });

    it('falls back to navigator.language when no localStorage or cookie', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('en');
    });

    it('returns ja from navigator.language when ja', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('ja');
    });

    it('returns ko as default when navigator.language is unsupported', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'fr-FR' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('ko');
    });

    it('returns ko when an exception is thrown', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('ko');
    });

    it('ignores invalid locale in cookie and checks navigator', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      Object.defineProperty(global, 'document', {
        value: { cookie: 'locale=zz; other=value' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });

      const result = LocaleDetector.detectClient();
      expect(result).toBe('en');
    });
  });

  describe('setClientLocale with browser environment', () => {
    it('sets localStorage and cookie', () => {
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });

      LocaleDetector.setClientLocale('en');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('locale', 'en');
      expect(global.document.cookie).toContain('locale=en');
    });

    it('sets locale to ja', () => {
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });

      LocaleDetector.setClientLocale('ja');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('locale', 'ja');
      expect(global.document.cookie).toContain('locale=ja');
    });

    it('sets cookie with 1 year expiry and proper attributes', () => {
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });

      LocaleDetector.setClientLocale('ko');

      expect(global.document.cookie).toContain('path=/');
      expect(global.document.cookie).toContain('SameSite=Lax');
      expect(global.document.cookie).toContain('expires=');
    });
  });

  describe('clearClientLocale with browser environment', () => {
    it('removes localStorage and sets expired cookie', () => {
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });

      LocaleDetector.clearClientLocale();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('locale');
      expect(global.document.cookie).toContain('locale=');
      expect(global.document.cookie).toContain('expires=Thu, 01 Jan 1970');
    });
  });
});
