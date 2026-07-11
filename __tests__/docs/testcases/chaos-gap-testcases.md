# Chaos Gap Testcases — api-key 포트 장애

배치: `__tests__/chaos/api-key-port-faults.test.ts` (신규 디렉토리 — vitest 자동 포함).

| TC | Given | When | Then |
|----|-------|------|------|
| TC-CHAOS-AK-001 | getValidation throw + repo에 유효 레코드 | validateApiKey | valid=true (repo 경로 지속) |
| TC-CHAOS-AK-002 | setValidation throw + repo 유효 레코드 | validateApiKey | valid=true 반환 (전파 없음) |
| TC-CHAOS-AK-003 | 만료 캐시 hit + invalidate throw + repo null | validateApiKey | valid=false 정상 반환 (전파 없음) |
| TC-CHAOS-AK-004 | invalidate throw | updateApiKey / deleteApiKey | reject (전파 — revoke 확실성) |

예상: 001~003은 현 구현이 전파하므로 **실패 → IMPL_BUG 판정 → 서비스 수정** (triage에서 확정).
