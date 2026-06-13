/**
 * Asymmetric JWT tests (RS256 / ES256 / EdDSA + JWKS-shaped split)
 *
 * Test Scope:
 * - privateKey 발급 + publicKey 검증 roundtrip (RS256/ES256/EdDSA)
 * - 발급/검증 분리: 검증 전용(publicKey only)은 sign 불가, 발급 전용은 verify 불가
 * - alg confusion 가드: 다른 알고리즘으로 검증 거부
 */

import { generateKeyPairSync } from 'node:crypto';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import type { JWTConfig } from '@withwiz/toolkit/core/auth/types';

const EXP = { accessTokenExpiry: '7d', refreshTokenExpiry: '30d' } as const;

function rsaKeys() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}
function ecKeys(namedCurve: string) {
  return generateKeyPairSync('ec', {
    namedCurve,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}
function edKeys() {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

const payload = { id: 'u1', userId: 'u1', email: 'a@b.com', role: 'USER' } as const;

describe('Asymmetric JWT', () => {
  const cases: Array<{ alg: JWTConfig['algorithm']; keys: () => { publicKey: string; privateKey: string } }> = [
    { alg: 'RS256', keys: rsaKeys },
    { alg: 'ES256', keys: () => ecKeys('P-256') },
    { alg: 'EdDSA', keys: edKeys },
  ];

  for (const { alg, keys } of cases) {
    describe(alg, () => {
      it('signs with privateKey and verifies with publicKey (roundtrip)', async () => {
        const { publicKey, privateKey } = keys();
        const svc = new JWTService({ algorithm: alg, ...EXP, privateKey, publicKey });

        const token = await svc.createAccessToken(payload);
        const verified = await svc.verifyAccessToken(token);
        expect(verified.userId).toBe('u1');
        expect(verified.email).toBe('a@b.com');
      });

      it('verify-only config (publicKey, no privateKey) cannot sign', async () => {
        const { publicKey } = keys();
        const verifier = new JWTService({ algorithm: alg, ...EXP, publicKey });
        await expect(verifier.createAccessToken(payload)).rejects.toMatchObject({
          code: 'TOKEN_CREATION_FAILED',
        });
      });

      it('split issuer/verifier: a token signed by the issuer verifies on the verifier', async () => {
        const { publicKey, privateKey } = keys();
        const issuer = new JWTService({ algorithm: alg, ...EXP, privateKey });
        const verifier = new JWTService({ algorithm: alg, ...EXP, publicKey });

        const token = await issuer.createAccessToken(payload);
        const verified = await verifier.verifyAccessToken(token);
        expect(verified.userId).toBe('u1');
      });

      it('sign-only config (privateKey, no publicKey) cannot verify', async () => {
        const { privateKey } = keys();
        const issuer = new JWTService({ algorithm: alg, ...EXP, privateKey });
        const token = await issuer.createAccessToken(payload);
        await expect(issuer.verifyAccessToken(token)).rejects.toMatchObject({
          code: 'TOKEN_VERIFICATION_FAILED',
        });
      });
    });
  }

  it('rejects construction when no key material is provided for an asymmetric algorithm', () => {
    expect(() => new JWTService({ algorithm: 'RS256', ...EXP })).toThrow();
  });

  it('alg confusion guard: an RS256 token is rejected by an ES256 verifier', async () => {
    const rsa = rsaKeys();
    const ec = ecKeys('P-256');
    const issuer = new JWTService({ algorithm: 'RS256', ...EXP, privateKey: rsa.privateKey });
    const wrongVerifier = new JWTService({ algorithm: 'ES256', ...EXP, publicKey: ec.publicKey });

    const token = await issuer.createAccessToken(payload);
    await expect(wrongVerifier.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'TOKEN_VERIFICATION_FAILED',
    });
  });

  it('still supports symmetric HS256 with a secret', async () => {
    const svc = new JWTService({ algorithm: 'HS256', ...EXP, secret: 'a'.repeat(32) });
    const token = await svc.createAccessToken(payload);
    const verified = await svc.verifyAccessToken(token);
    expect(verified.userId).toBe('u1');
  });
});
