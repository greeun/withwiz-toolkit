# Chaos Gap Scenarios — api-key 포트 장애 주입

외부 서비스는 포트(IApiKeyCacheStore 등) 뒤에 있음 — chaos 도메인은 **포트 장애 시 degrade 계약**을 소유한다.

## 스펙 판단 근거

이 모듈의 문서화된 설계 철학 (코드 주석):
- `api-key-auth.ts:41` — 사용량 확인 실패 → "가용성 우선 허용"
- `api-key.service.ts:134` — trackUsage "추적 실패는 무시"
- `api-key-auth.ts:47` — 예기치 못한 예외 → "안전한 500 degrade"

⇒ **캐시는 순수 최적화 계층**: validate 경로의 cache read/write 장애는 인증을 죽이면 안 되고 miss 취급이 스펙.
단, **mutation 경로(update/delete)의 invalidate 실패는 전파가 스펙** — revoke 지연은 보안 사고이므로 소비자에게 실패를 알려 재시도 유도.
stale-auth는 validate의 expiresAt 재검사(0.11.0)가 별도 방어.

| ID | 시나리오 | 스펙 | 없으면 나갈 버그 |
|----|---------|------|----------------|
| SC-CHAOS-AK-001 | cache.getValidation throw | miss 취급, repo로 검증 지속 | Redis 장애 = 전 API 인증 마비 |
| SC-CHAOS-AK-002 | cache.setValidation throw (검증 성공 후) | 무시, valid 결과 반환 | 캐시 쓰기 장애 = 유효 키 인증 실패 |
| SC-CHAOS-AK-003 | 만료 캐시 경로 cache.invalidate throw | 무시, repo 재조회 지속 | 부분 장애 시 만료 키 검증 경로 마비 |
| SC-CHAOS-AK-004 | updateApiKey/deleteApiKey의 invalidate throw | **전파** (보안: revoke 확실성) | invalidate 실패 무시 시 revoke 키가 TTL까지 유효 |
