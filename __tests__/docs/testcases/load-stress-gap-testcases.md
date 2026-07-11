# Load/Stress Gap Testcases — api-key

배치: `__tests__/performance/api-key/api-key-concurrency.test.ts` (신규 — 부하 인프라 없는 라이브러리라 performance 디렉토리에 동거, describe로 구분).

| TC | Given | When | Then |
|----|-------|------|------|
| TC-LOAD-AK-001 | fake repo/cache | Promise.all(validateApiKey × 100, 동일 키) | 전부 valid=true 동일 결과, reject 0 |
| TC-LOAD-AK-002 | incrementUsage 절반 실패 주입 | Promise.all(trackUsage × 100) | 전부 resolve (전파 0) |
