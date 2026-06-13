/**
 * Refresh Token Store (rotation + reuse detection)
 *
 * stateful refresh 토큰 추적 추상화. 구현은 소비자 몫(Redis/DB/메모리).
 *
 * 모델:
 * - 각 refresh 토큰은 고유 `jti` 를 가지며 회전 계보(`familyId`)에 속한다.
 * - 로그인 시 새 family 가 생성되고, 회전할 때마다 같은 family 안에서 새 jti 가
 *   발급되며 구 jti 는 used 로 표시된다.
 * - 이미 used 인 jti 가 다시 제출되면(=회전된 토큰 재사용) 탈취로 간주하고
 *   family 전체를 무효화한다(reuse detection).
 * - 로그아웃은 family 무효화로 즉시 stateful 무효화를 제공한다.
 *
 * reuse detection 에 필수인 것은 `isUsed`/`markUsed`/`isFamilyRevoked`/
 * `revokeFamily` 네 개다. `register` 는 TTL·감사 목적의 선택적 훅이다.
 */
export interface RefreshTokenRecord {
  jti: string;
  familyId: string;
  userId: string;
  /** 토큰 만료 시각 — store TTL 설정에 사용 가능. */
  expiresAt?: Date;
}

export interface IRefreshTokenStore {
  /** 이 jti 가 이미 회전(소비)되었는지 여부. */
  isUsed(jti: string): Promise<boolean>;

  /** 회전 시 구 jti 를 소비 처리한다. meta 로 TTL/계보 정보를 함께 줄 수 있다. */
  markUsed(
    jti: string,
    meta?: { familyId: string; userId: string; expiresAt?: Date },
  ): Promise<void>;

  /** family 전체가 무효화되었는지 여부. */
  isFamilyRevoked(familyId: string): Promise<boolean>;

  /** family 전체 무효화 (reuse 탐지 / 로그아웃). */
  revokeFamily(familyId: string): Promise<void>;

  /** (선택) 새 refresh 발급 기록 — store TTL/감사용. */
  register?(record: RefreshTokenRecord): Promise<void>;
}
