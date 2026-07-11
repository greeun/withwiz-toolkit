# Security Gap Scenarios — api-key

기존 security: auth(JWT/OAuth/password)·validators·error 노출만. api-key 없음.
IDOR·스코프 강제는 unit 소유(중복 금지) — security 도메인은 **비밀 재료 취급**만 소유.

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-SEC-AK-001 | raw key는 절대 미영속 — repo.create에는 sha256 해시만 전달 | DB 유출 시 전체 키 평문 노출 (해시 우회 회귀) |
| SC-SEC-AK-002 | 검증 실패 결과·ApiKeyError 메시지에 키 재료(raw/해시) 미포함 | 로그/응답 경유 키 유출 |
| SC-SEC-AK-003 | keyPreview는 해시 기반 축약 — 원문 복원 불가 형태 | 목록 UI 경유 키 유출 |
| SC-SEC-AK-004 | generateRawKey 유일성 (대량 생성 무충돌) | RNG 오사용(seed 고정 등) 시 키 충돌 → 타 계정 인증 |
