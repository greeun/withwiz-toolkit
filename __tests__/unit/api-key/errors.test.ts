/**
 * api-key typed error 단위 테스트
 *
 * 테스트 범위 (unit-gap-testcases.md):
 * - TC-UNIT-AKERR-001: isApiKeyError 비 Error 입력 거부
 * - TC-UNIT-AKERR-002: code 타입 위조 거부
 * - TC-UNIT-AKERR-003: code 인자 생략 시 코드 무관 판별
 * - TC-UNIT-AKERR-004: ApiKeyError 인스턴스 계약
 *
 * isApiKeyError의 기본 판별(일반 Error 거부·code 불일치·구조 판별)은
 * api-key.service.test.ts의 typed error 계약 테스트가 소유 — 여기서는 엣지 입력만.
 */
import { describe, it, expect } from 'vitest';
import { ApiKeyError, API_KEY_ERROR_CODES, isApiKeyError } from '../../../src/core/api-key/errors';

describe('isApiKeyError 엣지 입력', () => {
  it('TC-UNIT-AKERR-001: 비 Error 입력(null/undefined/문자열/plain object)은 false', () => {
    expect(isApiKeyError(null)).toBe(false);
    expect(isApiKeyError(undefined)).toBe(false);
    expect(isApiKeyError('ApiKeyError')).toBe(false);
    // Error 인스턴스가 아니면 구조가 같아도 거부
    expect(isApiKeyError({ name: 'ApiKeyError', code: API_KEY_ERROR_CODES.NOT_FOUND })).toBe(false);
  });

  it('TC-UNIT-AKERR-002: code가 string이 아닌 위조 Error는 false', () => {
    const forged = Object.assign(new Error('x'), { code: 40401 });
    forged.name = 'ApiKeyError';
    expect(isApiKeyError(forged)).toBe(false);
  });

  it('TC-UNIT-AKERR-003: code 인자 생략 시 어떤 코드든 ApiKeyError면 true', () => {
    for (const code of Object.values(API_KEY_ERROR_CODES)) {
      expect(isApiKeyError(new ApiKeyError('m', code))).toBe(true);
    }
  });

  it('TC-UNIT-AKERR-004: 인스턴스 계약 — name/message/code 보존 + Error 상속', () => {
    const err = new ApiKeyError('API key not found', API_KEY_ERROR_CODES.NOT_FOUND);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiKeyError');
    expect(err.message).toBe('API key not found');
    expect(err.code).toBe('API_KEY_NOT_FOUND');
  });
});
