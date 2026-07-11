# Integration Gap Scenarios — api-key 모듈 간 계약

기존 integration: cache 모듈만. api-key 모듈 간(서비스 ↔ key-generator ↔ validate) 실조합 검증 없음 —
unit은 각 모듈을 개별 검증하나, **generate가 저장한 해시를 validate가 동일 함수로 재계산하는 계약**은 라운드트립만 잡는다.

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-INT-AK-001 | generate 반환 rawKey로 validate 성공 (fake repo 해시 저장/조회) | generate/validate 해시 방식 분기(예: salt 도입 편측 적용) 시 발급 키 전부 무효 — 최악의 프로덕션 장애 |
| SC-INT-AK-002 | 수명주기: generate → validate(캐시 적재) → delete → 재validate 무효 | revoke 후에도 인증 지속(캐시 무효화 계약 파손) |

Layer ownership: 모듈 간 실조합만. 개별 모듈 로직 재검증 금지.
