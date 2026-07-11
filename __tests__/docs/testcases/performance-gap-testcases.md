# Performance Gap Testcases — api-key

배치: `__tests__/performance/api-key/api-key-hotpath.test.ts` (신규).

| TC | Given | When | Then |
|----|-------|------|------|
| TC-PERF-AK-001 | 고정 rawKey | hashKey × 10,000 | < 2,000ms (env `TEST_APIKEY_PERF_HASH_MS`) |
| TC-PERF-AK-002 | 캐시 hit 고정 결과 | validateApiKey × 1,000 | < 2,000ms + repo.findByHash 0회 |
