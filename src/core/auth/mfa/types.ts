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
  /**
   * 사용자를 ttlSec 동안 잠근다. 이번 호출이 잠금을 새로 만들었으면 true,
   * 만료되지 않은 잠금이 이미 있었으면 false(기존 잠금의 남은 시간은 그대로 둔다).
   */
  lock(userId: string, ttlSec: number): Promise<boolean>;
  /** 잠금 남은 초. 잠기지 않았으면 0. */
  lockedFor(userId: string): Promise<number>;
  /** 사용자 실패 횟수와 잠금을 지운다. */
  clearUser(userId: string): Promise<void>;
}

/** 사용자 MFA 설정 레코드. */
export interface UserMfaRecord {
  userId: string;
  /** 암호화된 TOTP 비밀 키 */
  secretEnc: string;
  /** 활성화 시각. null 이면 등록 대기(미확정) 상태 */
  enabledAt: Date | null;
  /** 마지막으로 사용된 TOTP 스텝(재사용 방지) */
  lastUsedStep: number | null;
}

/** MFA 저장소 — 비밀 키·복구 코드 영속화. */
export interface MfaRepository {
  findByUserId(userId: string): Promise<UserMfaRecord | null>;
  /** 대기 비밀 키를 저장(upsert, 미활성·lastUsedStep=null)하고 기존 복구 코드를 삭제한다. */
  savePendingSecret(userId: string, secretEnc: string): Promise<void>;
  /** enabledAt=now 로 활성화하고 복구 코드를 교체한다(한 트랜잭션). */
  enable(userId: string, recoveryCodeHashes: string[]): Promise<void>;
  /** UserMfa 와 복구 코드를 삭제한다. */
  disable(userId: string): Promise<void>;
  /** step 이 마지막 사용 스텝보다 크면 기록하고 true, 아니면 false(재사용). */
  markStepUsed(userId: string, step: number): Promise<boolean>;
  /** 미사용 복구 코드를 소비하면 true. */
  consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean>;
  replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void>;
  countUnusedRecoveryCodes(userId: string): Promise<number>;
}
