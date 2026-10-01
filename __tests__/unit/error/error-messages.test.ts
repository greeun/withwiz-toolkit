import { koMessages } from '@withwiz/toolkit/core/error/messages/ko';
import { enMessages } from '@withwiz/toolkit/core/error/messages/en';
import { jaMessages } from '@withwiz/toolkit/core/error/messages/ja';
import { getErrorMessage, getAllMessages, hasMessage, isLocaleSupported, supportedLocales } from '@withwiz/toolkit/core/error/messages';

describe('Error Messages Module', () => {
  describe('getErrorMessage', () => {
    it('returns Korean message for known code with default locale', () => {
      const result = getErrorMessage(40001);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });

    it('returns Korean message when locale is explicitly ko', () => {
      const result = getErrorMessage(40001, 'ko');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
    });

    it('returns English message for known code with en locale', () => {
      const result = getErrorMessage(40001, 'en');
      expect(result).toHaveProperty('title');
      expect(result.title).toMatch(/[A-Za-z]/);
    });

    it('returns default message for unknown error code', () => {
      const result = getErrorMessage(99999);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
    });

    it('returns default message for unknown code with en locale', () => {
      const result = getErrorMessage(99999, 'en');
      expect(result.title).toBe('Something went wrong');
      expect(result.description).toBe('An unexpected error occurred.');
    });

    it('returns Japanese message for known code with ja locale', () => {
      const result = getErrorMessage(40001, 'ja');
      expect(result.title).toBe('入力内容をご確認ください');
      expect(result.title).not.toBe(getErrorMessage(40001, 'ko').title);
    });

    it('falls back to Korean for an unsupported locale at runtime', () => {
      const result = getErrorMessage(40001, 'fr' as never);
      expect(result).toEqual(getErrorMessage(40001, 'ko'));
    });

    it('falls back to the Korean default for unknown code with an unsupported locale', () => {
      const result = getErrorMessage(99999, 'fr' as never);
      expect(result.title).toBe('문제가 발생했어요');
    });

    it('returns default ja message for unknown code with ja locale', () => {
      const result = getErrorMessage(99999, 'ja');
      expect(result.title).toBe('問題が発生しました');
    });
  });

  describe('getAllMessages', () => {
    it('returns full ko messages object for default locale', () => {
      const messages = getAllMessages();
      expect(typeof messages).toBe('object');
      expect(messages[40001]).toHaveProperty('title');
      expect(messages[40001]).toHaveProperty('description');
    });

    it('returns full ko messages object when explicitly ko', () => {
      const messages = getAllMessages('ko');
      expect(typeof messages).toBe('object');
      expect(messages[40001]).toBeDefined();
    });

    it('returns full en messages object', () => {
      const messages = getAllMessages('en');
      expect(typeof messages).toBe('object');
      expect(messages[40001]).toBeDefined();
      expect(messages[40001].title).toMatch(/[A-Za-z]/);
    });

    it('returns ja messages', () => {
      expect(getAllMessages('ja')).toBe(jaMessages);
    });
  });

  describe('locale dictionaries', () => {
    const koCodes = Object.keys(koMessages).sort();

    it.each([
      ['en', enMessages],
      ['ja', jaMessages],
    ] as const)('%s has exactly the same codes as ko', (_locale, messages) => {
      expect(Object.keys(messages).sort()).toEqual(koCodes);
    });

    it.each([
      ['en', enMessages],
      ['ja', jaMessages],
    ] as const)('%s fills every field that ko fills', (_locale, messages) => {
      for (const code of koCodes) {
        const ko = koMessages[Number(code)];
        const target = messages[Number(code)];
        expect(target.title, `${code}.title`).toBeTruthy();
        expect(target.description, `${code}.description`).toBeTruthy();
        expect(Boolean(target.action), `${code}.action`).toBe(Boolean(ko.action));
      }
    });

    it('ja messages are not copies of ko messages', () => {
      for (const code of koCodes) {
        expect(jaMessages[Number(code)].title, code).not.toBe(koMessages[Number(code)].title);
      }
    });
  });

  describe('hasMessage', () => {
    it('returns true for a known error code', () => {
      expect(hasMessage(40001)).toBe(true);
    });

    it('returns true for a known error code with en locale', () => {
      expect(hasMessage(40001, 'en')).toBe(true);
    });

    it('returns true for a known error code with ja locale', () => {
      expect(hasMessage(40001, 'ja')).toBe(true);
    });

    it('returns false for an unknown error code', () => {
      expect(hasMessage(99999)).toBe(false);
    });

    it('returns false for unknown code with en locale', () => {
      expect(hasMessage(99999, 'en')).toBe(false);
    });
  });

  describe('isLocaleSupported', () => {
    it('returns true for ko', () => {
      expect(isLocaleSupported('ko')).toBe(true);
    });

    it('returns true for en', () => {
      expect(isLocaleSupported('en')).toBe(true);
    });

    it('returns true for ja', () => {
      expect(isLocaleSupported('ja')).toBe(true);
    });

    it('returns false for fr', () => {
      expect(isLocaleSupported('fr')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isLocaleSupported('')).toBe(false);
    });

    it('returns false for random string', () => {
      expect(isLocaleSupported('xyz')).toBe(false);
    });

    it('returns false for uppercase locale', () => {
      expect(isLocaleSupported('KO')).toBe(false);
    });
  });

  describe('supportedLocales', () => {
    it('contains exactly ko, en, ja', () => {
      expect(supportedLocales).toEqual(['ko', 'en', 'ja']);
    });

    it('has length of 3', () => {
      expect(supportedLocales).toHaveLength(3);
    });
  });
});
