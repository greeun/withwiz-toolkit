# Unit Gap Scenarios — api-key 모듈 개편 (0.12.0)

기존 커버: generate(dev prefix/한도/제한플랜), validate(캐시 hit·miss·만료 재검사), update/delete 캐시 무효화, IDOR(비소유자 차단·스코프 강제), typed error 계약(4코드), regenerate 순증 판정 3종, isApiKeyError 기본 판별.

## Gap 시나리오 (미커버 분기)

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-UNIT-AKERR-001 | `isApiKeyError`에 비 Error 입력(null/문자열/code 있는 plain object) | 가드가 throw하거나 오탐 → 소비처 에러 핸들링 크래시 |
| SC-UNIT-AKERR-002 | code 인자 생략 시 코드 무관 ApiKeyError 판별 | 가드 시그니처 회귀 |
| SC-UNIT-AKSVC-001 | admin 요청은 소유권·스코프 우회 (getApiKey/updateApiKey/getApiKeys) | admin 콘솔이 타 사용자 키 관리 불가 |
| SC-UNIT-AKSVC-002 | customRateLimit은 플랜 한도로 clamp | 플랜 초과 rate limit 발급 |
| SC-UNIT-AKSVC-003 | expiresAt 미지정 시 defaultExpiryDays 적용, 지정 시 그대로 | 무기한 키 발급 |
| SC-UNIT-AKSVC-004 | production 환경 prefix(sk_live_) | 환경 오식별 키 발급 |
| SC-UNIT-AKSVC-005 | keepOldKeyActive 회전 성공 경로: deactivate 미호출 + 신키 발급 | 구키 유예 회전 기능 파손 |
| SC-UNIT-AKSVC-006 | regenerate 옵션 override(name/description) + 구키 속성 승계(permissions/environment/rateLimit/ipWhitelist) | 회전 시 권한·환경 유실 |

Layer ownership: 서비스 인가 로직은 unit 소유. security 파일에 중복 금지.
