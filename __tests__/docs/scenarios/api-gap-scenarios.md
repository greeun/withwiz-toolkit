# API Gap Scenarios — next/oapi api-key-auth (이 패키지의 엔드포인트 표면)

라이브러리라 HTTP 서버는 없음 — API 도메인은 `createApiKeyAuth` 핸들러의 요청/응답 계약을 소유한다.
기존 커버: 상태코드 5종(401/200경로/403 IP/403 usage/500). **응답 body(wire 계약)는 미검증.**

스펙 출처: `src/next/oapi/api-key-auth.ts:15` 주석 — "응답 code(40101/40301/50001)는 소비처 wire 계약 — 값 변경 금지". 이 주석이 이번 변경에서 명문화된 스펙이므로 테스트로 고정한다.

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-API-OAPI-001 | 모든 에러 응답 body가 `{success:false, error:{code, message}}` 형태 + code 값 40101/40301/50001 고정 | code 값 변경 시 소비처(profilehub) 에러 분기 파손 — 배포 후에야 발견 |
| SC-API-OAPI-002 | invalid key 401의 message는 validate 결과 message 전달 | 소비처 디버깅 정보 유실 |
| SC-API-OAPI-003 | usage 초과 메시지 daily/monthly 분기 | 잘못된 리셋 안내 |
| SC-API-OAPI-004 | usage tracker throw → 가용성 우선 허용 (인증 성공) | 사용량 스토어 장애가 전체 API 정지로 확산 |
| SC-API-OAPI-005 | resolveRole 결과(ADMIN)가 user.role에 반영 | 권한 오부여/누락 |

Layer ownership: 핸들러 요청/응답 계약은 이 파일(unit/oapi/api-key-auth.test.ts) 단독 소유.
