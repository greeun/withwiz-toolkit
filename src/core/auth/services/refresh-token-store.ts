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
 *
 * 동시 회전 경쟁: 같은 refresh 토큰으로 동시에 갱신하면 `isUsed` 확인과
 * `markUsed` 기록 사이에 두 요청이 모두 끼어들 수 있다. 선택 메서드
 * `markUsedIfUnused` 를 구현하면 TokenRefreshService 가 회전 시점에 이 원자
 * 연산으로 소비를 확정하므로 한 요청만 성공하고 나머지는 재사용으로 거부된다.
 * 미구현 저장소는 기존과 같이 `markUsed` 로 기록하며 동시 경쟁은 막지 못한다.
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

  /**
   * (선택) jti 가 아직 사용되지 않았을 때만 사용됨으로 기록한다 (compare-and-set).
   *
   * 확인과 기록은 원자적이어야 한다. 이번 호출이 기록했으면 true, 이미 사용된
   * jti 였으면 false 를 반환한다. 여러 서버 인스턴스가 저장소를 공유하면 저장소
   * 수준의 원자 연산(예: Redis `SET key value NX EX ttl`, DB 유니크 제약)으로 구현한다.
   */
  markUsedIfUnused?(
    jti: string,
    meta?: { familyId: string; userId: string; expiresAt?: Date },
  ): Promise<boolean>;

  /** (선택) 새 refresh 발급 기록 — store TTL/감사용. */
  register?(record: RefreshTokenRecord): Promise<void>;
}
