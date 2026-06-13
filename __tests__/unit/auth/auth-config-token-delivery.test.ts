import { initializeAuth, getAuthConfig, resetAuth } from '@withwiz/toolkit/core/auth/config';

const SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('AuthConfig tokenDelivery', () => {
  beforeEach(() => resetAuth());
  afterEach(() => resetAuth());

  it('미지정 시 hybrid 로 기본 해석된다', () => {
    initializeAuth({ jwtSecret: SECRET });
    expect(getAuthConfig().tokenDelivery).toBe('hybrid');
  });

  it('명시한 모드를 그대로 유지한다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'cookie' });
    expect(getAuthConfig().tokenDelivery).toBe('cookie');
  });

  it('header 모드도 허용한다', () => {
    initializeAuth({ jwtSecret: SECRET, tokenDelivery: 'header' });
    expect(getAuthConfig().tokenDelivery).toBe('header');
  });
});
