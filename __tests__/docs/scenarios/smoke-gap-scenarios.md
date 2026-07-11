# Smoke Gap Scenarios — api-key 0.12.0

Smoke = 배포(publish) 전 크리티컬 경로. 이 패키지의 배포 산출물 검증은 기존
`__tests__/build/exports-integrity.test.ts`가 소유 — package.json exports 데이터 주도이므로
신규 subpath `./core/api-key/errors`가 **자동 포함**된다 (dist 재빌드 전제).

## Gap: 없음 (신규 TC 0)

- 정적 존재/타입 선언/오염 검사: 기존 스위트가 자동 커버
- 런타임 import 검증: E2E 도메인(`consumer-runtime.test.ts`)이 소유 — 중복 금지

실행 절차만 확인: `npm run build` → `npm test` (build 디렉토리 포함 실행).
