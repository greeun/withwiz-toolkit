# Unit Gap Testcases — api-key 모듈 개편

배치: `__tests__/unit/api-key/errors.test.ts`(신규, src 미러), `__tests__/unit/api-key/api-key.service.test.ts`(기존 확장).

| TC | 시나리오 | Given | When | Then |
|----|---------|-------|------|------|
| TC-UNIT-AKERR-001 | SC-AKERR-001 | null / 'x' / {name:'ApiKeyError',code:...} plain object | isApiKeyError | 전부 false (Error 인스턴스 아님) |
| TC-UNIT-AKERR-002 | SC-AKERR-001 | code가 숫자인 위조 Error | isApiKeyError | false (code는 string이어야) |
| TC-UNIT-AKERR-003 | SC-AKERR-002 | ApiKeyError(NOT_FOUND) | isApiKeyError(err) — code 생략 | true |
| TC-UNIT-AKERR-004 | — | ApiKeyError 인스턴스 | name/message/code 속성 | name='ApiKeyError', code 보존, Error 상속 |
| TC-UNIT-AKSVC-101 | SC-AKSVC-001 | 타인 소유 키, isAdmin=true | getApiKey/updateApiKey | 성공 (OWNERSHIP 미발생) |
| TC-UNIT-AKSVC-102 | SC-AKSVC-001 | isAdmin=true + filters.userId 지정 | getApiKeys | findMany에 요청 filters 그대로 (requesterId 미강제) |
| TC-UNIT-AKSVC-103 | SC-AKSVC-002 | planRate=100, customRateLimit=500 | generateApiKey | repo.create rateLimit=100 |
| TC-UNIT-AKSVC-104 | SC-AKSVC-002 | planRate=100, customRateLimit=50 | generateApiKey | repo.create rateLimit=50 |
| TC-UNIT-AKSVC-105 | SC-AKSVC-003 | expiresAt 미지정, defaultExpiryDays=365 | generateApiKey | create.expiresAt ≈ now+365d |
| TC-UNIT-AKSVC-106 | SC-AKSVC-003 | expiresAt 명시 | generateApiKey | create.expiresAt = 지정값 |
| TC-UNIT-AKSVC-107 | SC-AKSVC-004 | environment='production' | generateApiKey | rawKey가 prefixProd로 시작 |
| TC-UNIT-AKSVC-108 | SC-AKSVC-005 | 한도 여유 + keepOldKeyActive=true | regenerateApiKey | deactivate 미호출, create 호출, 신키 반환 |
| TC-UNIT-AKSVC-109 | SC-AKSVC-006 | 구키 속성(permissions=['read','write'], dev, rateLimit=42, ipWhitelist) + name override | regenerateApiKey | create 인자에 승계값 + override name |

hasMore 계산(getApiKeys)은 TC-UNIT-AKSVC-102에서 total/page로 함께 검증.
