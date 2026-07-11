# Load/Stress Gap Scenarios — api-key (사용자 지정으로 포함)

서버 부하 대상이 없는 라이브러리 — 이 도메인은 **동시성 안전 계약**을 소유한다:
서비스가 이벤트 루프에서 동시 호출될 때 결과 일관성·unhandled rejection 부재.

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-LOAD-AK-001 | 동시 100 validateApiKey (miss→hit 혼재) | 캐시 경합 시 결과 불일치/거부 폭주 |
| SC-LOAD-AK-002 | 동시 100 trackUsage (일부 실패 주입) | 사용 추적 폭주가 인증 경로 crash 유발 |

## 알려진 한계 (테스트로 고정하지 않음 — 보고만)

`generateApiKey`의 한도 검사는 check-then-act — **서비스 계층은 동시 발급 TOCTOU를 원자적으로 막지 않는다**.
원자성은 repo 구현(DB unique/transaction) 책임. 서비스 레벨 테스트로 초과 발급을 "정상"으로 고정하면
향후 개선을 막으므로 테스트화하지 않고 문서로만 기록.
