# Performance Gap Scenarios — api-key (사용자 지정으로 포함)

라이브러리 함수의 성능 계약: 인증 hot path(요청마다 실행)가 회귀로 급격히 느려지는 것을 잡는다.
임계값은 CI 변동 감안해 넉넉히 — 목적은 정밀 벤치마크가 아니라 **차수 단위 회귀 감지**(예: sync 해시가 실수로 비동기 대기·이중 해시로 변질).

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-PERF-AK-001 | hashKey 10k회 처리량 상한 | 요청당 해시가 이중/느린 알고리즘으로 회귀 → 전 API 지연 |
| SC-PERF-AK-002 | validateApiKey 캐시 hit 1k회 상한 + repo 0회 | 캐시 경로에 동기 병목 유입 |

환경변수로 수치 조정 가능 (`TEST_APIKEY_PERF_*`), 기존 performance/cache 컨벤션 준수.
