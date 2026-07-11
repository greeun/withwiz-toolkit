# E2E Gap Testcases — dist 소비자 여정

배치: `__tests__/build/consumer-runtime.test.ts` (신규 — build 레이어 옆, dist 의존 공유).

| TC | Given | When | Then |
|----|-------|------|------|
| TC-E2E-AK-001 | 빌드된 dist | `dist/core/api-key/errors.js` dynamic import | ApiKeyError 생성·isApiKeyError(code) 판별 정상 |
| TC-E2E-AK-002 | dist api-key.service + errors + key-generator | 발급→validate→regenerate→구키 validate | 신키 valid, 구키 invalid(INACTIVE), 에러 시 isApiKeyError 판별 가능 |
