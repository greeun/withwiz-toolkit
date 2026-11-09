/**
 * MFA(TOTP) 공용 타입·상수.
 */

/** MFA 시도 한도. 시간 단위는 모두 초. */
export const MFA_LIMITS = {
  /** 대기 토큰 만료 */
  pendingTtlSec: 300,
  /** 대기 토큰 하나당 허용 실패 횟수(넘으면 폐기) */
  perPendingMaxFailures: 5,
  /** 사용자당 창 안에서 허용 실패 횟수(넘으면 잠금) */
  perUserMaxFailures: 10,
  /** 사용자 실패 집계 창(첫 실패부터 고정) */
  userWindowSec: 900,
  /** 잠금 시간 */
  lockSec: 900,
} as const;

/**
 * MFA 시도 저장소 — 대기 토큰 1회 소비, 실패 횟수, 사용자 잠금.
 * 시간 인자는 모두 초 단위다.
 */
export interface MfaAttemptStore {
  /** 대기 토큰 jti 를 소비한다. 처음이면 true, 이미 소비됐으면 false. */
  consumePending(jti: string, ttlSec: number): Promise<boolean>;
  /** 대기 토큰 jti 가 이미 소비됐는지 여부. */
  isPendingConsumed(jti: string): Promise<boolean>;
  /** 대기 토큰별 실패를 기록하고 누적 횟수를 반환한다. */
  recordPendingFailure(jti: string, ttlSec: number): Promise<number>;
  /** 사용자 실패를 기록하고 누적 횟수를 반환한다. 창은 첫 실패 시각부터 고정. */
  recordUserFailure(userId: string, windowSec: number): Promise<number>;
  /** 사용자를 ttlSec 동안 잠근다. */
  lock(userId: string, ttlSec: number): Promise<void>;
  /** 잠금 남은 초. 잠기지 않았으면 0. */
  lockedFor(userId: string): Promise<number>;
  /** 사용자 실패 횟수와 잠금을 지운다. */
  clearUser(userId: string): Promise<void>;
}
