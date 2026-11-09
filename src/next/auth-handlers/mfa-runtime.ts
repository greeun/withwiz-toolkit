import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import {
  MfaService,
  createSecretBox,
  createInMemoryMfaAttemptStore,
  type MfaAttemptStore,
} from '@withwiz/toolkit/core/auth/mfa';
import type { AuthHandlerOptions } from '@withwiz/toolkit/next/auth-types/handler-types';
import { JWT_DEFAULTS } from '@withwiz/toolkit/core/constants/security';

/** MFA 처리기들이 공유하는 부품 묶음 */
export interface MfaRuntime {
  service: MfaService;
  jwtService: JWTService;
  attemptStore: MfaAttemptStore;
  cookiePath: string;
}

const runtimes = new WeakMap<object, MfaRuntime>();

/**
 * MFA 런타임. `mfa.enabled` 가 아니면 null.
 * `options.mfa` 객체당 한 번만 만들어 login·oauth·/mfa/* 처리기가 같은 attemptStore 를 공유한다.
 * jwtService 는 session.ts 와 같은 옵션으로 만들어 대기 토큰이 처리기 사이에서 검증된다.
 */
export function getMfaRuntime(options: AuthHandlerOptions): MfaRuntime | null {
  const mfa = options.mfa;
  if (!mfa?.enabled) return null;

  const cached = runtimes.get(mfa);
  if (cached) return cached;

  if (!options.urls.mfaChallenge) {
    throw new Error('options.urls.mfaChallenge is required when options.mfa.enabled is true');
  }

  const { dependencies, hooks, jwt } = options;
  let attemptStore = mfa.attemptStore;
  if (!attemptStore) {
    dependencies.logger?.warn('MFA attemptStore not set — in-memory store is single-instance only');
    attemptStore = createInMemoryMfaAttemptStore();
  }

  const service = new MfaService({
    repository: mfa.repository,
    attemptStore,
    secretBox: createSecretBox(mfa.encryptionKeys),
    issuer: mfa.issuer,
    onFailure: async (userId, reason) => {
      await hooks?.onMfaFailed?.(userId, reason);
    },
    onLocked: async (userId) => {
      if (!hooks?.onMfaLocked) return;
      const user = await dependencies.userRepository.findById(userId);
      if (user) await hooks.onMfaLocked(user);
    },
  });

  const jwtService = new JWTService({
    secret: jwt.secret,
    accessTokenExpiry: jwt.accessTokenExpiry ?? JWT_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES,
    refreshTokenExpiry: jwt.refreshTokenExpiry ?? JWT_DEFAULTS.DEFAULT_REFRESH_TOKEN_EXPIRES,
    algorithm: JWT_DEFAULTS.ALGORITHM,
  });

  const runtime: MfaRuntime = { service, jwtService, attemptStore, cookiePath: mfa.cookiePath ?? '/api/auth' };
  runtimes.set(mfa, runtime);
  return runtime;
}
