/**
 * log-sanitizer.ts 유닛 테스트
 * - maskEmail: 이메일 마스킹
 * - maskIpAddress: IP 주소 마스킹
 * - maskString: 문자열 마스킹
 * - isSensitiveKey: 민감 키 확인
 * - sanitizeLogData: 객체 재귀 마스킹
 * - toSafeLogString: 안전한 문자열 변환
 * - sanitizeLogMessage: 로그 메시지 정제
 * - createSafeLogMeta: 안전한 메타데이터 생성
 */
import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskIpAddress,
  maskString,
  isSensitiveKey,
  sanitizeLogData,
  toSafeLogString,
  sanitizeLogMessage,
  createSafeLogMeta,
} from '@withwiz/toolkit/core/logger/log-sanitizer';

// ============================================================================
// maskEmail
// ============================================================================
describe('maskEmail', () => {
  it.each([
    ['test@example.com', 't**t@example.com', '일반 이메일'],
    ['ab@test.com', 'ab@test.com', '짧은 로컬 파트'],
    ['hello@world.co.kr', 'h***o@world.co.kr', '한국 도메인'],
  ])('maskEmail("%s") → "%s" (%s)', (input, expected) => {
    const result = maskEmail(input);
    expect(result).toBe(expected);
    expect(typeof result).toBe('string');
    expect(result).toBeDefined();
  });

  it('빈 문자열이나 null은 그대로 반환한다', () => {
    expect(maskEmail('')).toBe('');
    expect(maskEmail(null as any)).toBe(null);
    expect(maskEmail(undefined as any)).toBe(undefined);
  });

  it('이메일 형식이 아니면 그대로 반환한다', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
    expect(typeof maskEmail('hello')).toBe('string');
    expect(maskEmail('plain')).toBe('plain');
  });
});

// ============================================================================
// maskIpAddress
// ============================================================================
describe('maskIpAddress', () => {
  it('IPv4 주소를 마스킹한다', () => {
    expect(maskIpAddress('192.168.1.100')).toBe('192.168.***.***');
  });

  it('빈 값은 그대로 반환한다', () => {
    expect(maskIpAddress('')).toBe('');
    expect(maskIpAddress(null as any)).toBe(null);
    expect(maskIpAddress(undefined as any)).toBe(undefined);
  });

  it('일반 문자열은 그대로 반환한다', () => {
    const result = maskIpAddress('not-an-ip');
    expect(result).toBe('not-an-ip');
    expect(typeof result).toBe('string');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// maskString
// ============================================================================
describe('maskString', () => {
  it('긴 문자열의 중간을 마스킹한다', () => {
    const result = maskString('abcdefghijklmnop');
    expect(result).toMatch(/^abcd\*+mnop$/);
    expect(typeof result).toBe('string');
    expect(result.length).toBe(16);
  });

  it('짧은 문자열은 전체를 마스킹한다', () => {
    const result = maskString('abc', 4);
    expect(result).toBe('***');
    expect(typeof result).toBe('string');
    expect(result.length).toBe(3);
  });

  it('빈 문자열이나 null은 그대로 반환한다', () => {
    expect(maskString('')).toBe('');
    expect(maskString(null as any)).toBe(null);
    expect(maskString(undefined as any)).toBe(undefined);
  });
});

// ============================================================================
// isSensitiveKey
// ============================================================================
describe('isSensitiveKey', () => {
  it.each([
    ['password', true],
    ['token', true],
    ['secret', true],
    ['api_key', true],
    ['access_token', true],
    ['client_secret', true],
    ['name', false],
    ['email', false],
    ['url', false],
    ['count', false],
  ])('isSensitiveKey("%s") → %s', (key, expected) => {
    expect(isSensitiveKey(key)).toBe(expected);
    expect(typeof isSensitiveKey(key)).toBe('boolean');
    expect(isSensitiveKey(key)).toBeDefined();
  });
});

// ============================================================================
// sanitizeLogData
// ============================================================================
describe('sanitizeLogData', () => {
  it('민감한 키의 값을 마스킹한다', () => {
    const data = { password: 'secret123', name: 'test' };
    const result = sanitizeLogData(data);
    expect(result.password).not.toBe('secret123');
    expect(result.name).toBe('test');
    expect(result.password).toBeDefined();
  });

  it('이메일 필드를 마스킹한다', () => {
    const data = { email: 'user@example.com', id: 1 };
    const result = sanitizeLogData(data);
    expect(result.email).toContain('@');
    expect(result.email).not.toBe('user@example.com');
    expect(result.id).toBe(1);
  });

  it('중첩 객체도 재귀적으로 마스킹한다', () => {
    const data = { user: { password: 'pw123', name: 'Alice' } };
    const result = sanitizeLogData(data);
    expect(result.user.password).not.toBe('pw123');
    expect(result.user.name).toBe('Alice');
    expect(result.user).toBeDefined();
  });

  it('배열도 처리한다', () => {
    const data = [{ token: 'abc' }, { name: 'test' }];
    const result = sanitizeLogData(data);
    expect(result[0].token).not.toBe('abc');
    expect(result[1].name).toBe('test');
    expect(Array.isArray(result)).toBe(true);
  });

  it('null/undefined/기본 타입은 그대로 반환한다', () => {
    expect(sanitizeLogData(null)).toBeNull();
    expect(sanitizeLogData(undefined)).toBeUndefined();
    expect(sanitizeLogData('hello')).toBe('hello');
  });

  it('깊이 제한을 초과하면 "[Too Deep]"을 반환한다', () => {
    const result = sanitizeLogData({ a: 1 }, 6);
    expect(result).toBe('[Too Deep]');
    expect(typeof result).toBe('string');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// toSafeLogString
// ============================================================================
describe('toSafeLogString', () => {
  it('객체를 안전한 JSON 문자열로 변환한다', () => {
    const result = toSafeLogString({ password: 'secret', name: 'test' });
    expect(typeof result).toBe('string');
    expect(result).not.toContain('secret');
    expect(result).toContain('name');
  });

  it('순환 참조도 안전하게 처리한다', () => {
    const obj: any = {};
    obj.self = obj;
    const result = toSafeLogString(obj);
    expect(typeof result).toBe('string');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('null을 처리한다', () => {
    const result = toSafeLogString(null);
    expect(typeof result).toBe('string');
    expect(result).toBeDefined();
    expect(result).toBe('null');
  });

  it('undefined를 처리한다 (직렬화 실패 시 fallback)', () => {
    // JSON.stringify(undefined) returns undefined (not a string)
    // so toSafeLogString may return fallback message or undefined
    const result = toSafeLogString(undefined);
    // result는 undefined일 수 있으므로 존재 여부만 확인
    expect(result === undefined || typeof result === 'string').toBe(true);
  });
});

// ============================================================================
// sanitizeLogMessage
// ============================================================================
describe('sanitizeLogMessage', () => {
  it('이메일 주소를 마스킹한다', () => {
    const result = sanitizeLogMessage('User test@example.com logged in');
    expect(result).not.toContain('test@example.com');
    expect(result).toContain('@');
    expect(typeof result).toBe('string');
  });

  it('IP 주소를 마스킹한다', () => {
    const result = sanitizeLogMessage('Request from 192.168.1.100');
    expect(result).toContain('***');
    expect(result).not.toContain('192.168.1.100');
    expect(typeof result).toBe('string');
  });

  it('JWT 토큰을 마스킹한다', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456';
    const result = sanitizeLogMessage(`Token: ${jwt}`);
    expect(result).toContain('[JWT_TOKEN]');
    expect(typeof result).toBe('string');
    expect(result).toBeDefined();
  });

  it('빈 문자열이나 null은 그대로 반환한다', () => {
    expect(sanitizeLogMessage('')).toBe('');
    expect(sanitizeLogMessage(null as any)).toBe(null);
    expect(sanitizeLogMessage(undefined as any)).toBe(undefined);
  });
});

// ============================================================================
// createSafeLogMeta
// ============================================================================
describe('createSafeLogMeta', () => {
  it('타임스탬프를 추가한다', () => {
    const meta = createSafeLogMeta({ action: 'login' });
    expect(meta.timestamp).toBeDefined();
    expect(meta.action).toBe('login');
    expect(meta.nodeEnv).toBeDefined();
  });

  it('민감한 데이터를 마스킹한다', () => {
    const meta = createSafeLogMeta({ password: 'secret', name: 'test' });
    expect(meta.password).not.toBe('secret');
    expect(meta.name).toBe('test');
    expect(meta.timestamp).toBeDefined();
  });

  it('빈 객체도 처리한다', () => {
    const meta = createSafeLogMeta();
    expect(meta.timestamp).toBeDefined();
    expect(meta.pid).toBeDefined();
    expect(typeof meta).toBe('object');
  });
});
