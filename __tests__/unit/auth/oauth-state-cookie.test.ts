/**
 * OAuth state-cookie 유닛 (O-1)
 */
import {
  validateOAuthState,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  generateOAuthState,
  OAUTH_STATE_COOKIE,
} from '@withwiz/toolkit/core/auth/oauth/state-cookie';

describe('validateOAuthState', () => {
  it('returns true only when both are equal non-empty strings', () => {
    expect(validateOAuthState('abc', 'abc')).toBe(true);
  });

  it('returns false when cookie is missing', () => {
    expect(validateOAuthState(undefined, 'abc')).toBe(false);
    expect(validateOAuthState(null, 'abc')).toBe(false);
    expect(validateOAuthState('', 'abc')).toBe(false);
  });

  it('returns false when query state is missing', () => {
    expect(validateOAuthState('abc', undefined)).toBe(false);
    expect(validateOAuthState('abc', null)).toBe(false);
    expect(validateOAuthState('abc', '')).toBe(false);
  });

  it('returns false on mismatch', () => {
    expect(validateOAuthState('abc', 'abd')).toBe(false);
  });
});

function fakeResponse() {
  const calls: Array<{ name: string; value: string; opts: any }> = [];
  return {
    calls,
    cookies: {
      set: (name: string, value: string, opts: any) =>
        calls.push({ name, value, opts }),
    },
  };
}

describe('setOAuthStateCookie / clearOAuthStateCookie', () => {
  it('sets an HttpOnly, SameSite=lax, path=/, maxAge=600 cookie', () => {
    const res = fakeResponse();
    setOAuthStateCookie(res, 'nonce-1', { secure: true });
    expect(res.calls).toHaveLength(1);
    const { name, value, opts } = res.calls[0];
    expect(name).toBe(OAUTH_STATE_COOKIE);
    expect(value).toBe('nonce-1');
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
  });

  it('clears the cookie with maxAge=0 and empty value', () => {
    const res = fakeResponse();
    clearOAuthStateCookie(res);
    const { name, value, opts } = res.calls[0];
    expect(name).toBe(OAUTH_STATE_COOKIE);
    expect(value).toBe('');
    expect(opts.maxAge).toBe(0);
    expect(opts.httpOnly).toBe(true);
  });

  it('omits domain when not provided, includes it when provided', () => {
    const a = fakeResponse();
    setOAuthStateCookie(a, 's');
    expect('domain' in a.calls[0].opts).toBe(false);

    const b = fakeResponse();
    setOAuthStateCookie(b, 's', { domain: '.example.com' });
    expect(b.calls[0].opts.domain).toBe('.example.com');
  });

  it('generateOAuthState returns a non-empty unique string', () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
