# E2E Gap Scenarios — 소비자 여정 (npm 패키지 라이브러리)

UI 없는 라이브러리의 E2E = **소비자가 실제 사용하는 경로**: 빌드 산출물(dist)을 subpath로 import해 전체 플로우 실행.
기존 build 테스트는 파일 존재·메타데이터만 검사 — **dist 코드가 실제로 실행되는지는 미검증** (ESM 문법 오류·순환 참조·경로 alias 잔재는 존재 검사로 못 잡음).

| ID | 시나리오 | 없으면 나갈 버그 |
|----|---------|----------------|
| SC-E2E-AK-001 | dist `core/api-key/errors.js` 런타임 import → ApiKeyError/isApiKeyError 동작 | 신규 subpath가 배포 후 import 실패 (0.12.0 핵심 신기능 파손) |
| SC-E2E-AK-002 | dist ApiKeyService로 소비자 전체 여정: 발급 → 인증 → 회전 → 구키 무효 | 빌드 산출물 수준 회귀 — src 테스트만으론 tsup 변환 오류 미감지 |

전제: `npm run build` 선행. dist 부재 시 명확한 실패 메시지로 안내.
Layer ownership: dist 실행 검증만. 로직 상세는 unit 소유.
