# Integration Gap Testcases — api-key

배치: `__tests__/integration/api-key/api-key-flow.integration.test.ts` (신규).
fake: in-memory Map repo(해시 키 저장), in-memory Map cache. key-generator/validate는 실모듈.

| TC | Given | When | Then |
|----|-------|------|------|
| TC-INT-AK-001 | fake repo/cache + 실 해시 | generateApiKey → 반환 rawKey로 validateApiKey | valid=true, user/apiKey 매핑 정확 |
| TC-INT-AK-002 | TC-001 상태 | validate(캐시 적재) → deleteApiKey → 동일 rawKey 재validate | 캐시 무효화 후 valid=false (INVALID_API_KEY) |
