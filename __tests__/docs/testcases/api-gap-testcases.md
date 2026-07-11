# API Gap Testcases — api-key-auth wire 계약

배치: `__tests__/unit/oapi/api-key-auth.test.ts` (기존 파일 확장 — 동일 엔드포인트 1파일 규칙).

| TC | Given | When | Then |
|----|-------|------|------|
| TC-API-OAPI-001 | x-api-key 없음 | 핸들러 호출 | body `{success:false, error:{code:40101, message:'X-API-Key header is required'}}` |
| TC-API-OAPI-002 | validate가 `{valid:false, message:'API key has expired'}` | 핸들러 호출 | 401 + code 40101 + message 전달 |
| TC-API-OAPI-003 | IP whitelist 위반 | 핸들러 호출 | 403 + code 40301 |
| TC-API-OAPI-004 | usage DAILY_LIMIT / MONTHLY_LIMIT | 핸들러 호출 | 403 + code 40301 + 'daily'/'monthly' 메시지 분기 |
| TC-API-OAPI-005 | validateApiKey throw | 핸들러 호출 | 500 + code 50001 |
| TC-API-OAPI-006 | usage.canMakeApiCall throw | 핸들러 호출 | 인증 성공(user 반환) — 가용성 우선 |
| TC-API-OAPI-007 | resolveRole → 'ADMIN' | 핸들러 호출 | user.role='ADMIN', apiKeyId/plan 매핑 정확 |
