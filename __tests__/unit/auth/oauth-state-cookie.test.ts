/**
 * OAuth state-cookie 유닛 (O-1)
 */
import { validateOAuthState } from '@withwiz/core/auth/oauth/state-cookie';

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
