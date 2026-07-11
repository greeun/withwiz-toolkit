# False Positive Audit (허위 양성 감사)

> 실행일: 2026-07-12 · 대상: `__tests__/` 전체 · 트리거: api-key 모듈 개편 풀테스트

## 결과 요약

| 위험도 | 건수 | 조치 |
|--------|------|------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 6 | 기록만 (변경 범위 밖, 사유 있음) |

`expect(true)` / `[SKIP]` / `.catch(() => null)` / 빈 테스트 본문 / TODO placeholder: **0건**.

## MEDIUM — 느슨한 `toContain` 허용 (환경 의존적 사유 있음)

| 위치 | 패턴 | 판정 |
|------|------|------|
| `unit/auth/jwt-service.test.ts:197` | `['INVALID_PAYLOAD','TOKEN_VERIFICATION_FAILED']` | jose 버전별 에러 분기 차이 — 허용 가능. 단일 코드로 좁힐 수 있는지 후속 검토 권장 |
| `unit/system/system.test.ts:36,157,306` | platform 값 목록 | 실행 OS 의존 — 정당 |
| `security/validators/validators.test.ts:138,156` | PasswordStrength 인접 2단계 허용 | 스코어링 경계값 — 단일 값 고정 가능하면 좁힐 것 권장 |

## `!== undefined` 히트 (허위 양성 아님)

`unit/auth/handlers/token-delivery.test.ts:88`, `unit/auth/handlers/handlers.test.ts:162`,
`security/cors-credential-reflection.test.ts:26`, `security/auth/oauth-state-csrf.test.ts:56`
— 전부 테스트 헬퍼의 조건 분기이며 assertion 아님. coverage HTML 히트는 산출물.

## 참고

- `TEST_DEDUP_POLICY.md` 부재 — 본 감사·gap 문서가 layer ownership을 명시하나, 정책 파일 신설 권장.
