import { resolveTokenDelivery } from '@withwiz/toolkit/next/auth-types/handler-types';
import { initializeAuth, resetAuth } from '@withwiz/toolkit/core/auth/config';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('resolveTokenDelivery 우선순위', () => {
  beforeEach(() => resetAuth());
  afterEach(() => resetAuth());

  it('아무것도 없으면 hybrid', () => {
    expect(resolveTokenDelivery()).toBe('hybrid');
  });

  it('전역 config 를 읽는다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    expect(resolveTokenDelivery()).toBe('cookie');
  });

  it('핸들러 옵션이 전역 config 보다 우선한다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    expect(resolveTokenDelivery('header')).toBe('header');
  });
});
