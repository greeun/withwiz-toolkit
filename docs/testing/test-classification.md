# @withwiz/toolkit 테스트 분류 체계

## 개요

| 항목 | 내용 |
|------|------|
| 대상 | `@withwiz/toolkit` 0.15.0 공유 유틸 라이브러리 (`core/`, `next/`, `prisma/` 계층) |
| 범위 | `src/` 전체 (core: api-key, auth, cache, config, constants, cors, error, geolocation, logger, storage, system, types, utils, validators / next: auth-handlers, auth-types, error, middleware, oapi, utils, proxy / prisma: auth-adapter), `__tests__/` 테스트 파일 124개 |
| 기준 커밋 | `610750c` (브랜치 `fix/residual-defects`, develop `dd4f7d8` = 0.15.0 에서 분기) |
| 환경 | Vitest 4.0.18, Node.js 22.22.0, `environment: 'node'` (파일 단위 jsdom 지정 없음), 설정 `__tests__/vitest.config.ts`, 셋업 `__tests__/setup.ts` |
| 의존성 설치 | `npm ci` (`package-lock.json` 기준). `pnpm install --frozen-lockfile` 은 `pnpm-lock.yaml` 이 없어 `ERR_PNPM_NO_LOCKFILE` 로 중단됨 |
| 실행 전제 | `npm run build` 선행. `__tests__/build/` 의 2개 파일은 `dist/` 가 없으면 실패함 |
| 목표 커버리지 | 미설정 (`__tests__/vitest.config.ts` 에 `coverage.thresholds` 없음) |
| 실측 커버리지 (참고) | Stmts 75.98% (4,183/5,505), Branches 72.36% (2,652/3,665), Funcs 82.71% (895/1,082), Lines 76.41% (3,936/5,151). 2026-09-16 `--coverage.include=src/**` 로 측정 (2026-09-13 판: Stmts 72.86%, Branches 69.54%, Funcs 79.19%, Lines 73.29%) |
| 실측 결과 (2026-09-16) | 파일 124개 전부 통과, 케이스 2,824건 중 통과 2,824 · 실패 0 · 스킵 0 · todo 0 |
| 문서 이력 | 2026-09-13 0.15.0 (`63c492c`) 기준 최초 작성: 테스트 파일 121개, 2,723건, SC 58개 (✅ 47 / 🔲 11), TC 62개 (✅ 51 / 🔲 11). 2026-09-16 `fix/residual-defects` (`610750c`) 기준 갱신: 결함 4건 수정(`c07a669` `handlePrismaError()` 매핑표 불일치, `5ba8eff` `withCache()` 원본 함수 이중 실행, `977efc2` refresh 토큰 동시 회전, `535faec` CSV 파일명 비 ASCII 문자)과 허위 양성 테스트 2개 교체(`e37468c`, `610750c`)를 반영하고 TC-U-027·028·029, TC-I-002·003, TC-E-002 를 🔲 계획에서 ✅ 완료로 전환 (124개 파일, 2,824건, SC ✅ 53 / 🔲 5, TC ✅ 57 / 🔲 5) |

실측은 `npx vitest run -c __tests__/vitest.config.ts --reporter=json` 결과를 기준으로 삼았고, 이 문서에 기재한 파일별 테스트 수는 모두 이 결과에서 옮겼다.

결함이 수정되어 회귀 테스트가 추가된 🔲 계획 TC 는 ✅ 완료로 전환하고, 단계와 예상 결과를 실제 테스트 기준으로 다시 쓴다. 결함 당시의 동작은 해당 TC 의 "결함 이력"에 남긴다. 허위 양성 파일을 교체한 TC 도 같은 방식으로 교체 전 상태를 남긴다. 2026-09-16 기준 전환 대상은 TC-U-027·028·029, TC-I-002·003, TC-E-002 이다.

### 라이브러리 맥락의 도메인 재해석

이 패키지는 HTTP 서버와 렌더링 UI 를 갖지 않는 라이브러리이므로, 일부 도메인은 아래와 같이 라이브러리 관점으로 재해석해 적용한다.

| 도메인 | 이 문서에서 쓰는 의미 | 물리 위치 |
|--------|----------------------|-----------|
| Unit | 모듈 단위 로직 검증 | `__tests__/unit/` 중 API 도메인 20개 파일을 제외한 76개 파일 |
| API | `src/next/` 의 라우트 핸들러·미들웨어·프록시·oapi 가 반환하는 요청/응답 계약 (상태 코드, 응답 body, 헤더) | `unit/oapi/`, `unit/auth/handlers/`, `unit/auth/types/`, `unit/middleware/`, `unit/proxy.test.ts` |
| Integration | 실제 모듈을 조합한 계약 검증 | `__tests__/integration/` |
| E2E | 빌드 산출물(`dist/`)을 import 해 실행하는 소비자 여정 | `__tests__/build/consumer-runtime.test.ts` |
| Security | 비밀 재료 취급, 인증 우회·XSS·CORS·정보 노출 방어 | `__tests__/security/` |
| Performance | 차수 단위 처리 시간 회귀 감지와 대용량 캐시 동작 | `__tests__/performance/` 중 Load/Stress 1개 파일을 제외한 5개 파일 |
| Load/Stress | 이벤트 루프에서 동시 호출될 때의 결과 일관성과 unhandled rejection 부재 | `__tests__/performance/api-key/api-key-concurrency.test.ts` |
| Smoke | 배포 전 exports 무결성과 dist 산출물 검증 | `__tests__/build/exports-integrity.test.ts` |
| Chaos | 포트(외부 저장소 추상화) 장애 주입 시 degrade 계약 | `__tests__/chaos/` |
| Accessibility | 미적용 (렌더링되는 UI 요소가 없음) | 없음 |

---

## 시나리오 목록

| ID | 시나리오 | 유형 | 우선순위 | 상태 |
|----|---------|------|---------|------|
| SC-U-001 | api-key 서비스 발급·검증·회전·인가 | Unit | Critical | ✅ 완료 |
| SC-U-002 | api-key 키 생성·레코드 검증·IP 화이트리스트·오류 타입 | Unit | High | ✅ 완료 |
| SC-U-003 | JWT 토큰 서비스와 토큰 전달 모드 해석 | Unit | Critical | ✅ 완료 |
| SC-U-004 | 인증 쿠키와 OAuth state 쿠키 속성 | Unit | High | ✅ 완료 |
| SC-U-005 | OAuth 프로바이더 응답 매핑과 매니저 레지스트리 | Unit | High | ✅ 완료 |
| SC-U-006 | 인증 서비스 (로그인·가입·토큰 갱신·비밀번호 재설정·이메일 인증·OAuth 콜백·토큰 저장소) | Unit | Critical | ✅ 완료 |
| SC-U-007 | 인증 저장소 어댑터 (SQL·Prisma) | Unit | High | ✅ 완료 |
| SC-U-008 | 이메일 발송과 보안 토큰 생성기 | Unit | Medium | ✅ 완료 |
| SC-U-009 | 캐시 설정·환경 해석·미초기화 팩토리 | Unit | High | ✅ 완료 |
| SC-U-010 | 캐시 매니저 폴백·Redis 전역 상태·용량 가드 | Unit | High | ✅ 완료 |
| SC-U-011 | 설정 레지스트리와 initialize | Unit | High | ✅ 완료 |
| SC-U-012 | AppError·오류 코드·다국어 메시지 | Unit | High | ✅ 완료 |
| SC-U-013 | 오류 분류와 HTTP 오류 응답 변환 | Unit | Critical | ✅ 완료 |
| SC-U-014 | Prisma 오류 분류 (code 속성 기준)와 오류 로그 길이 제한 | Unit | Critical | ✅ 완료 |
| SC-U-015 | geolocation 기본 공급자와 배치 처리 | Unit | Medium | ✅ 완료 |
| SC-U-016 | 로거 요청·응답 기록과 민감 정보 마스킹 | Unit | Medium | ✅ 완료 |
| SC-U-017 | R2 스토리지 업로드·조회·삭제 | Unit | Medium | ✅ 완료 |
| SC-U-018 | 시스템 환경 점검·헬스체크·명령 실행 유틸 | Unit | Medium | ✅ 완료 |
| SC-U-019 | 입력 검증 (SSRF·XSS·SQL 패턴)과 새니타이저 | Unit | High | ✅ 완료 |
| SC-U-020 | URL 정규화와 IP 유틸 | Unit | High | ✅ 완료 |
| SC-U-021 | 형식 변환·타입 가드·코드 생성기·낙관적 잠금·기동 배너 | Unit | Medium | ✅ 완료 |
| SC-U-022 | utils 다중 모듈 회귀 스위트 (`utils.test.ts`) | Unit | Low | ✅ 완료 |
| SC-U-023 | Prisma 매핑표 전 코드 계약과 `handlePrismaError` 경로 일치 | Unit | High | ✅ 완료 |
| SC-U-024 | CSV 내보내기 실제 소스 검증 (구현 복제 테스트 교체) | Unit | High | ✅ 완료 |
| SC-U-025 | `withCache` 래퍼와 캐시 무효화 헬퍼 | Unit | Medium | ✅ 완료 |
| SC-U-026 | GeoIP 공급자 구현 4종과 공급자 팩토리 | Unit | Low | 🔲 계획 |
| SC-U-027 | 브라우저용 JWT 클라이언트 유틸 | Unit | Low | 🔲 계획 |
| SC-I-001 | api-key 모듈 간 해시 계약과 수명주기 | Integration | Critical | ✅ 완료 |
| SC-I-002 | 캐시 계층 실제 조합 (목 객체만 검증하는 기존 테스트 교체) | Integration | High | ✅ 완료 |
| SC-I-003 | 인증 서비스와 캐시 기반 토큰 저장소 실제 조합 | Integration | High | ✅ 완료 |
| SC-A-001 | oapi API 키 인증 wire 계약 | API | Critical | ✅ 완료 |
| SC-A-002 | oapi 헬퍼와 OpenAPI 스펙 생성 | API | Medium | ✅ 완료 |
| SC-A-003 | 인증 라우트 핸들러 응답 계약 | API | Critical | ✅ 완료 |
| SC-A-004 | tokenDelivery 모드별 핸들러 입출력 | API | High | ✅ 완료 |
| SC-A-005 | 인증 미들웨어 토큰 추출·검증 | API | Critical | ✅ 완료 |
| SC-A-006 | 역할 기반 접근 제어 | API | High | ✅ 완료 |
| SC-A-007 | API 래퍼 구성과 미들웨어 체인 실행 | API | High | ✅ 완료 |
| SC-A-008 | 요청 보안 미들웨어 (Content-Type·Origin) | API | High | ✅ 완료 |
| SC-A-009 | Rate limit 미들웨어 | API | High | ✅ 완료 |
| SC-A-010 | Edge 인증 프록시 | API | High | ✅ 완료 |
| SC-A-011 | 요청 초기화·오류 응답·응답 기록 미들웨어 실제 동작 | API | High | 🔲 계획 |
| SC-E-001 | dist api-key 소비자 여정 | E2E | Critical | ✅ 완료 |
| SC-E-002 | dist Prisma 오류 분류 소비자 여정 | E2E | High | ✅ 완료 |
| SC-S-001 | api-key 비밀 재료 취급 | Security | Critical | ✅ 완료 |
| SC-S-002 | JWT 서명·알고리즘 혼동·토큰 종류 혼동 방어 | Security | Critical | ✅ 완료 |
| SC-S-003 | OAuth CSRF state 검증과 인가 URL 파라미터 | Security | Critical | ✅ 완료 |
| SC-S-004 | 비밀번호 해싱과 해시 마이그레이션 | Security | Critical | ✅ 완료 |
| SC-S-005 | 비밀번호 정책 클래스와 검증 상수 | Security | High | ✅ 완료 |
| SC-S-006 | CORS 자격 증명 반사 방지 | Security | Critical | ✅ 완료 |
| SC-S-007 | 오류 응답 내부 정보 노출 방지 | Security | High | ✅ 완료 |
| SC-S-008 | XSS 새니타이저 | Security | High | ✅ 완료 |
| SC-P-001 | api-key 인증 hot path 처리 시간 상한 | Performance | High | ✅ 완료 |
| SC-P-002 | 캐시 매니저 대용량 eviction·기능 회귀 | Performance | Medium | ✅ 완료 |
| SC-L-001 | api-key 동시 호출 결과 일관성 | Load/Stress | High | ✅ 완료 |
| SC-L-002 | 인메모리 캐시 카운터·용량 동시 호출 일관성 | Load/Stress | Medium | 🔲 계획 |
| SC-SM-001 | exports 무결성과 dist 산출물 검증 | Smoke | Critical | ✅ 완료 |
| SC-C-001 | api-key 포트 장애 degrade 계약 | Chaos | High | ✅ 완료 |
| SC-C-002 | refresh 토큰 저장소 장애 시 갱신·로그아웃 동작 | Chaos | High | 🔲 계획 |

Accessibility 도메인은 적용 대상이 아니므로 시나리오를 두지 않는다 (7절 참조).

---

## 1. Unit Tests (단위 테스트)

**목적:** 개별 모듈 로직을 외부 의존성 없이 검증한다. 저장소·캐시·외부 HTTP 같은 포트는 `vi.fn()` 페이크나 `vi.mock` 으로 대체한다.

**실행 명령:** `npm run test:unit`

`test:unit` 스크립트는 `__tests__/unit` 디렉토리 전체(98개 파일)를 실행하므로 3절 API 도메인의 20개 파일도 함께 실행된다. 단위 도메인만 분리해 실행하는 스크립트는 없다.

---

### TC-U-001: api-key 서비스 (ApiKeyService)

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-001 |
| **파일** | `__tests__/unit/api-key/api-key.service.test.ts` |
| **대상** | `src/core/api-key/api-key.service.ts`: `ApiKeyService.generateApiKey()`, `validateApiKey()`, `regenerateApiKey()`, `getApiKey()`, `getApiKeys()`, `updateApiKey()`, `deleteApiKey()`, `trackUsage()` |
| **우선순위** | Critical |
| **전제조건** | repo·cache·planConfig·usage 포트를 `vi.fn()` 페이크로 주입 |
| **테스트 데이터** | `prefixDev: 'sk_test_'`, `prefixProd: 'sk_live_'`, 플랜 rate limit 100, 제한 플랜 `FREEMIUM` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `generateApiKey('u1', { environment: 'development' }, 'PRO')` 호출 | 반환 키가 `sk_test_` 로 시작, `repo.create` 1회 호출 |
| 2 | `customRateLimit: 500` 과 `50` 으로 각각 발급 (`TC-UNIT-AKSVC-103/104`) | `repo.create` 인자 `rateLimit` 이 `100` (플랜 한도로 clamp), `50` |
| 3 | 만료일 `2000-01-01` 인 검증 결과가 캐시에 있는 상태에서 `validateApiKey()` 호출 | `cache.invalidate`·`repo.findByHash` 호출, `valid: false` |
| 4 | 타인 소유 키를 비관리자가 `getApiKey('k1', 'u1')` 로 조회 | `/unauthorized/i` 오류로 reject (IDOR 차단) |
| 5 | 한도 1·활성 1 상태에서 구키 비활성화 회전 `regenerateApiKey()` | `repo.deactivate('k1')` 호출, 새 키가 `sk_live_` 로 시작 (순증 0 허용) |
| 6 | 제한 플랜 `FREEMIUM` 으로 `regenerateApiKey()` 호출 | `isApiKeyError(err, PLAN_RESTRICTED)` 가 `true`, `deactivate`·`invalidate` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 32개 (현재)
- **관련 문서:** [unit-gap-scenarios.md](../../__tests__/docs/scenarios/unit-gap-scenarios.md), [unit-gap-testcases.md](../../__tests__/docs/testcases/unit-gap-testcases.md) (ID 대응은 「3세대 문서 연계와 ID 대응표」 절 참조)

---

### TC-U-002: api-key 키 생성기·레코드 검증·IP 화이트리스트·오류 타입

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-002 |
| **파일** | `__tests__/unit/api-key/key-generator.test.ts`, `__tests__/unit/api-key/validate.test.ts`, `__tests__/unit/api-key/ip-whitelist.test.ts`, `__tests__/unit/api-key/errors.test.ts` |
| **대상** | `src/core/api-key/key-generator.ts`: `generateRawKey()`, `hashKey()`, `keyPreview()` / `validate.ts`: `validateApiKeyRecord()` / `ip-whitelist.ts`: `isIpInCidr()`, `isIpAllowed()` / `errors.ts`: `isApiKeyError()` |
| **우선순위** | High |
| **전제조건** | 없음 (순수 함수) |
| **테스트 데이터** | prefix `sk_test_`, CIDR `192.168.1.0/24`, 잘못된 마스크 `/40`·`/33`·`/-1` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `generateRawKey('sk_test_')` 호출 | `sk_test_` 로 시작, 길이 `'sk_test_'.length + 64` |
| 2 | `keyPreview('a'×10 + 'b'×50 + 'cccc')` 호출 | `'aaaaaaaaaa...cccc'` 반환 |
| 3 | 만료일 `2000-01-01` 레코드로 `validateApiKeyRecord()` 호출 | `error: 'EXPIRED_API_KEY'` |
| 4 | `isIpInCidr('192.168.1.5', '192.168.1.0/24')`, `isIpInCidr('192.168.2.5', ...)` | `true`, `false` |
| 5 | `isIpInCidr('192.99.99.99', '192.168.1.0/40')` | `false` (마스크 범위 밖 fail-open 방지) |
| 6 | `isApiKeyError({ name: 'ApiKeyError', code: NOT_FOUND })` (plain object) | `false` |

- **자동화:** 가능 ✅ | **테스트 수:** 22개 (errors 4, ip-whitelist 7, key-generator 5, validate 6)

---

### TC-U-003: JWT 서비스와 기간 문자열 변환

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-003 |
| **파일** | `__tests__/unit/auth/jwt-service.test.ts`, `__tests__/unit/auth/duration.test.ts` |
| **대상** | `src/core/auth/jwt/index.ts`: `JWTService`, `JWTManager` / `src/core/auth/duration.ts`: `durationToSeconds()` |
| **우선순위** | Critical |
| **전제조건** | 만료 케이스는 짧은 만료로 서명한 뒤 1.5초 실제 대기 |
| **테스트 데이터** | 시크릿 `'a'.repeat(32)` (경계값), `'short'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 만료된 access 토큰을 `verifyAccessToken()` 으로 검증 | `JWTError`, code `TOKEN_EXPIRED` |
| 2 | access 토큰을 `verifyRefreshToken()` 으로 검증 | `JWTError`, code `INVALID_PAYLOAD` 또는 `TOKEN_VERIFICATION_FAILED` |
| 3 | `extractTokenFromHeader('Basic abc123')` 호출 | `null` |
| 4 | 시크릿 `'short'` 로 `new JWTManager()`, 32자 시크릿으로 생성 | 전자는 `JWTError` throw, 후자는 throw 없음 |
| 5 | `durationToSeconds('7d')`, `('15m')`, `('30s')` | `604800`, `900`, `30` |
| 6 | `durationToSeconds('7x')` | throw |

- **자동화:** 가능 ✅ | **테스트 수:** 33개 (jwt-service 29, duration 4)
- **비고:** 단계 2 의 복수 코드 허용은 `FALSE_POSITIVE_AUDIT.md` 에 MEDIUM 으로 기록되어 있다.

---

### TC-U-004: tokenDelivery 모드 해석

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-003 |
| **파일** | `__tests__/unit/auth/auth-config-token-delivery.test.ts`, `__tests__/unit/auth/token-delivery-resolve.test.ts` |
| **대상** | `src/core/auth/config.ts`: `initializeAuth()` / `src/core/auth/token-delivery.ts`: `resolveTokenDelivery()` |
| **우선순위** | High |
| **전제조건** | `beforeEach`·`afterEach` 에서 `resetAuth()` 호출 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 설정 없이 `resolveTokenDelivery()` 호출 | `'hybrid'` |
| 2 | `initializeAuth({ tokenDelivery: 'cookie' })` 후 `resolveTokenDelivery()` | 전역 설정값 `'cookie'` |
| 3 | 전역 `'cookie'` 상태에서 `resolveTokenDelivery('header')` | 핸들러 옵션 `'header'` 우선 |
| 4 | `initializeAuth({ jwtSecret })` 후 `getAuthConfig().tokenDelivery` 확인 | `'hybrid'` |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (auth-config-token-delivery 3, token-delivery-resolve 3)

---

### TC-U-005: 인증 쿠키와 OAuth state 쿠키

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-004 |
| **파일** | `__tests__/unit/auth/cookie.test.ts`, `__tests__/unit/auth/oauth-state-cookie.test.ts` |
| **대상** | `src/core/auth/jwt/cookie.ts`: `setTokenCookies()`, `clearTokenCookies()` / `src/core/auth/oauth/state-cookie.ts`: `validateOAuthState()`, `setOAuthStateCookie()`, `clearOAuthStateCookie()`, `generateOAuthState()` |
| **우선순위** | High |
| **전제조건** | `NODE_ENV=test` (Secure 속성 미포함 조건) |
| **테스트 데이터** | auth 미초기화 시 기본 만료 7d/30d, 초기화 시 `accessTokenExpiry: '15m'`, `refreshTokenExpiry: '7d'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `setTokenCookies(response, tokenPair)` 호출 | access·refresh 쿠키 모두 `HttpOnly` 포함 |
| 2 | 같은 호출의 Path 확인 | access `Path=/;`, refresh `Path=/api/auth` |
| 3 | auth 미초기화 상태와 `15m`/`7d` 초기화 상태에서 각각 호출 | `Max-Age=604800`/`2592000`, 이후 `Max-Age=900`/`604800` |
| 4 | `clearTokenCookies(response)` 호출 | access 쿠키에 `Max-Age=0` |
| 5 | `setOAuthStateCookie(res, 'nonce-1', { secure: true })` 호출 | `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 600` |
| 6 | `validateOAuthState('abc', 'abc')` 호출 | `true` (둘 중 하나라도 없거나 다르면 `false`) |

- **자동화:** 가능 ✅ | **테스트 수:** 25개 (cookie 17, oauth-state-cookie 8)

---

### TC-U-006: OAuth 프로바이더와 매니저 레지스트리

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-005 |
| **파일** | `__tests__/unit/auth/oauth-providers.test.ts`, `__tests__/unit/auth/oauth-meta.test.ts`, `__tests__/unit/auth/oauth-microsoft.test.ts`, `__tests__/unit/auth/oauth-manager-registry.test.ts` |
| **대상** | `src/core/auth/oauth/providers/{google,github,kakao,meta,microsoft}.ts`: `getLoginUrl()`, `exchangeCodeForToken()`, `getUserInfo()` / `src/core/auth/oauth/index.ts`: `OAuthManager.registerProvider()` |
| **우선순위** | High |
| **전제조건** | `global.fetch` 를 `vi.fn()` 으로 대체, Microsoft 는 테스트에서 서명한 id_token 사용 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | GitHub `getUserInfo()` 응답 `{ id: 99999 }` | `id` 가 문자열 `'99999'` |
| 2 | Kakao 응답에서 `is_email_valid`·`is_email_verified` 가 모두 없음 | `emailVerified: false` |
| 3 | Meta 토큰 교환이 HTTP 200 이지만 `access_token` 없음 | `OAuthError`, 메시지 `Invalid Meta response` |
| 4 | Microsoft id_token 의 `aud` 가 clientId 와 다름 | `Invalid Microsoft id_token` 으로 reject |
| 5 | Microsoft 서명이 없는 위조 id_token 으로 `getUserInfo()` | `Invalid Microsoft id_token` 으로 reject |
| 6 | 미등록 프로바이더 `'naver'` 로 `getLoginUrl()`, 빌트인 `google` 을 `registerProvider()` 로 교체 | 전자는 `Unsupported OAuth provider: naver`, 후자는 교체한 어댑터 URL 반환 |

- **자동화:** 가능 ✅ | **테스트 수:** 103개 (oauth-providers 46, oauth-meta 13, oauth-microsoft 19, oauth-manager-registry 25)

---

### TC-U-007: 인증 서비스

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-006 |
| **파일** | `__tests__/unit/auth/services/login.service.test.ts`, `register.service.test.ts`, `token-refresh.service.test.ts`, `password-reset.service.test.ts`, `email-verification.service.test.ts`, `oauth-callback.service.test.ts`, `cache-token-stores.test.ts` (모두 `__tests__/unit/auth/services/` 아래) |
| **대상** | `src/core/auth/services/`: `LoginService`, `RegisterService`, `TokenRefreshService`, `PasswordResetService`, `EmailVerificationService`, `OAuthCallbackService`, `createCacheBlacklistChecker()`, `createCacheRefreshTokenStore()` |
| **우선순위** | Critical |
| **전제조건** | UserRepository·토큰 저장소는 `vi.fn()` 페이크, bcrypt `compare` 는 mock, 토큰 저장소 테스트는 `InMemoryCacheManager` 실인스턴스 |
| **테스트 데이터** | refresh 토큰 `{ jti: 'J1', familyId: 'F1' }`, 토큰 해시 `sha256(평문)` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 존재하지 않는 이메일로 `login()` | `Invalid credentials` reject, 더미 `compare` 1회 수행 (타이밍 균일화) |
| 2 | refresh store 주입 후 `refresh(t1)` | 새 refresh 토큰 발급, `J1` used 처리, 새 토큰 familyId `F1` 유지 |
| 3 | 회전된 `t1` 재제출 | `Refresh token reuse detected` reject, `F1` revoke, 회전된 새 토큰도 `Token has been revoked` |
| 4 | 공급자 이메일 미검증 상태로 기존 계정과 같은 이메일의 OAuth 콜백 | `not verified` reject, 계정 연결 생성 없음 |
| 5 | `requestReset()` 호출 | 저장 토큰이 `sha256(메일 발송 토큰)` 과 같고 평문과 다름 |
| 6 | `createCacheBlacklistChecker().revokeAccessToken('super-secret-token', 60)` | 캐시 키가 `/^revoked:at:[0-9a-f]{64}$/` 형식, 원문 미포함 |
| 7 | `markUsedIfUnused` 를 구현한 저장소 페이크가 `false` 를 반환할 때 `refresh(t1)` | `TOKEN_REUSE_DETECTED` (401), `revokeFamily('F1')` 호출, `register` 미호출. `true` 면 `markUsed` 대신 `markUsedIfUnused('J1', { familyId: 'F1', userId })` 로 회전 |
| 8 | 같은 조건에서 `markUsedIfUnused` 가 throw | 원본 오류로 reject, `revokeFamily`·`register` 미호출. 이 메서드가 없는 저장소는 기존과 같이 `markUsed` 로 회전 |
| 9 | `createCacheRefreshTokenStore(InMemoryCacheManager)` 의 `markUsedIfUnused` 를 같은 jti 로 동시 10건 | `true` 1건. 캐시가 `setIfNotExists` 를 제공하면 그 결과를 쓰고 `exists`·`set` 미호출, 기록 중 캐시 오류 뒤 다음 호출은 다시 시도 |

- **자동화:** 가능 ✅ | **테스트 수:** 70개 (login 9, register 5, token-refresh 17, password-reset 7, email-verification 8, oauth-callback 6, cache-token-stores 18)
- **변경 이력:** 2026-09-16 커밋 `977efc2` 에서 refresh 토큰 동시 회전 결함(TC-I-003)을 수정하면서 단계 7~9 의 12건(token-refresh 5, cache-token-stores 7)을 추가했다.

---

### TC-U-008: SQL 인증 저장소 어댑터

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-007 |
| **파일** | `__tests__/unit/auth/adapters/sql/dialect.test.ts`, `user-repository.test.ts`, `email-token-repository.test.ts`, `oauth-account-repository.test.ts` (모두 `__tests__/unit/auth/adapters/sql/` 아래) |
| **대상** | `src/core/auth/adapters/sql/`: `getDialect()`, `ParamBuilder`, `SqlUserRepository`, `SqlEmailTokenRepository`, `SqlOAuthAccountRepository` |
| **우선순위** | High |
| **전제조건** | 쿼리 실행기를 `createMockExec()` 로 대체해 전송 SQL·파라미터를 캡처 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `getDialect('postgres')` 의 `placeholder(1)`, `quoteId('email')` | `'$1'`, `'"email"'` |
| 2 | `getDialect('oracle')` | `Unsupported SQL dialect: oracle` throw |
| 3 | `SqlUserRepository.findByEmail('test@example.com')` (postgres) | password 컬럼을 포함한 SELECT 와 `['test@example.com']` 전송, 반환 객체에 `password` 포함 |
| 4 | `tables: { user: 'app_users' }`, `userColumns: { email: 'email_address' }` 설정 후 조회 | SQL 에 `FROM "app_users"`, `"email_address" = $` 포함 |
| 5 | `SqlEmailTokenRepository.deleteExpired()` | 세 토큰 테이블에 `DELETE ... WHERE "expires" < $1` 3회 |

- **자동화:** 가능 ✅ | **테스트 수:** 34개 (dialect 6, user-repository 11, email-token-repository 10, oauth-account-repository 7)

---

### TC-U-009: Prisma 인증 저장소 어댑터

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-007 |
| **파일** | `__tests__/unit/auth/prisma-adapter.test.ts`, `__tests__/unit/auth/prisma-adapter-config.test.ts` |
| **대상** | `src/prisma/auth-adapter/index.ts`: `PrismaUserRepository`, `PrismaOAuthAccountRepository`, `PrismaEmailTokenRepository` |
| **우선순위** | High |
| **전제조건** | Prisma 클라이언트를 `mockPrisma` 객체로 대체 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `PrismaEmailTokenRepository.create(..., 'UNKNOWN_TYPE', ...)` | `Unsupported token type: UNKNOWN_TYPE` reject |
| 2 | `PrismaOAuthAccountRepository.update('acc-1', { accessToken, refreshToken, expiresAt, ... })` | `account.update` 가 `token.upsert` (create·update 동일 값, `expiresAt` 초 단위) 로 호출 |
| 3 | `userFields: { emailVerified: 'verifiedAt' }` 설정 후 `verifyEmail()` | `user.update` 의 data 가 `{ verifiedAt: Date }` |
| 4 | MAGIC_LINK 토큰 생성 / EMAIL_VERIFICATION 토큰 생성 | 전자만 data 에 `used: false` 포함 |

- **자동화:** 가능 ✅ | **테스트 수:** 55개 (prisma-adapter 36, prisma-adapter-config 19)

---

### TC-U-010: 이메일 발송과 토큰 생성기

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-008 |
| **파일** | `__tests__/unit/auth/email/sender.test.ts`, `__tests__/unit/auth/token-generator.test.ts` |
| **대상** | `src/core/auth/email/sender.ts`: `SmtpEmailSender` / `src/core/auth/email/token-generator.ts`: `TokenGenerator` |
| **우선순위** | Medium |
| **전제조건** | nodemailer `createTransport`·`sendMail` mock |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `port: 465` 설정으로 발송 | `createTransport` 인자 `secure: true` |
| 2 | verification 템플릿만 커스텀 후 인증 메일·비밀번호 재설정 메일 발송 | 제목이 각각 `Custom Only`, `Reset your password` |
| 3 | `TokenGenerator.generateUrlSafe()` 20회 | `+`, `/`, `=` 미포함 |
| 4 | `TokenGenerator.hash(generate())` | 원본 토큰과 다른 값 |
| 5 | `TokenGenerator.generatePIN(6)` | 길이 6, 0 이상 1000000 미만 |

- **자동화:** 가능 ✅ | **테스트 수:** 40개 (sender 19, token-generator 21)

---

### TC-U-011: 캐시 설정·환경 해석·미초기화 팩토리

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-009 |
| **파일** | `__tests__/unit/cache/cache-config.test.ts`, `__tests__/unit/cache/cache-env.test.ts`, `__tests__/unit/cache/cache-factory-uninitialized.test.ts` |
| **대상** | `src/core/cache/cache-config.ts`: `getCacheConfig`, `getCacheTTL` / `cache-env.ts`: `getConfig()`, `validateRedisEnvironment()` / `cache-factory.ts`: 모듈 import 시점 동작 |
| **우선순위** | High |
| **전제조건** | `cache-env`·`config/common` 을 `vi.mock` 으로 대체, 팩토리 테스트는 `initializeCache()` 미호출 상태에서 동적 import |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 전역 캐시 비활성 (`isCacheEnabled` → `false`) 상태에서 `getCacheConfig.analytics.enabled()` | `false` |
| 2 | Redis URL 이 공백 `'   '` 인 설정으로 `validateRedisEnvironment()` | `isValid: false`, errors 에 `Redis URL is an empty string.` |
| 3 | `getCommonConfig()` 가 throw 하는 상태에서 `getConfig()` | `env.NODE_ENV` 가 `'development'` 로 폴백 |
| 4 | `initializeCache()` 없이 `cache-factory` 동적 import | import 가 reject 되지 않음 |
| 5 | 같은 상태에서 `cache.get('any-key')`, `cache.set('any-key', 'value')` | 각각 `null`, `undefined` 로 resolve (no-op 로 degrade) |

- **자동화:** 가능 ✅ | **테스트 수:** 47개 (cache-config 22, cache-env 22, cache-factory-uninitialized 3)

---

### TC-U-012: 캐시 매니저 폴백·Redis 전역 상태·용량 가드

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-010 |
| **파일** | `__tests__/unit/cache/hybrid-cache-manager.test.ts`, `__tests__/unit/cache/cache-fallback.test.ts`, `__tests__/unit/cache/cache-redis.test.ts`, `__tests__/unit/cache/inmemory-cache-manager.test.ts` |
| **대상** | `src/core/cache/hybrid-cache-manager.ts`: `HybridCacheManager` / `cache-redis.ts`: `notifyRedisError()`, `isRedisGloballyDisabled()`, `checkRedisConnection()` / `inmemory-cache-manager.ts`: `InMemoryCacheManager.set()` |
| **우선순위** | High |
| **전제조건** | Redis 매니저를 `createMockRedisManager()` 로 대체, logger mock |
| **테스트 데이터** | `redisErrorThreshold: 3`, 전역 임계값 기본 3, `maxMemoryMB: 0.001` + 2,048자 문자열 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | get 이 계속 실패하는 Redis 로 hybrid 매니저 `get()` 3회 | `redisErrorCount: 3`, `redisConnected: false` |
| 2 | Redis `set`·`get` 이 실패하는 hybrid 매니저에 `set('failover-key', ...)` 후 `get()` | 메모리에서 `'failover-value'` 반환 |
| 3 | backend `redis` 에서 `checkConnection()` 이 `false` | 매니저 `checkConnection()` 이 `false` |
| 4 | `notifyRedisError()` 2회 후, 3회째 | 2회까지 `isRedisGloballyDisabled()` `false`, 3회째 `true` + warn 로그 |
| 5 | PING 응답이 `'ERROR'` 일 때 `checkRedisConnection()` | `success: false`, error 에 `Redis PING response differs from expected` |
| 6 | 단일 항목이 `maxMemoryMB` 초과 / `maxSize: 0` 에서 `set()` | 2초 안에 반환하고 저장하지 않음, 기존 항목 유지 (무한 루프 방지) |

- **자동화:** 가능 ✅ | **테스트 수:** 77개 (hybrid-cache-manager 35, cache-fallback 13, cache-redis 26, inmemory-cache-manager 3)
- **비고:** `cache-fallback.test.ts` 의 `should fallback to in-memory cache when Redis get throws` 는 `failingRedis.get` 호출 여부만 단언하므로 폴백 값 반환은 이 파일에서 검증되지 않는다. 폴백 값 반환은 단계 2 (`hybrid-cache-manager.test.ts`) 가 검증한다.

---

### TC-U-013: 설정 레지스트리와 initialize

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-011 |
| **파일** | `__tests__/unit/config/registry.test.ts`, `auth-config.test.ts`, `cache-config.test.ts`, `common.test.ts`, `cors-config.test.ts`, `errors.test.ts`, `geolocation-config.test.ts`, `logger-config.test.ts`, `storage-config.test.ts` (앞의 9개는 `__tests__/unit/config/` 아래), `__tests__/unit/initialize.test.ts` |
| **대상** | `src/initialize.ts`: `initialize()` / `src/core/config/registry.ts`: `config`, `resetConfig()` / 모듈별 `initializeAuth()`, `initializeCache()`, `initializeCommon()`, `initializeCors()`, `initializeGeolocation()`, `initializeLogger()`, `initializeStorage()` / `src/core/config/errors.ts`: `ConfigurationError` |
| **우선순위** | High |
| **전제조건** | `beforeEach` 에서 모듈별 reset 함수로 설정 저장소 초기화, `console.warn` 억제 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `initialize()` 후 `config.auth` 와 `getAuthConfig()` 비교 | 동일 객체 (`toBe`) |
| 2 | `initialize(FULL_CONFIG)` → `resetConfig()` 후 모듈별 getter 호출 | auth·logger·cache·storage·geolocation·cors getter 모두 throw |
| 3 | `initialize({ nodeEnv: 'test', auth })` 만 호출 | common·auth 는 조회되고 cache·storage getter 는 `ConfigurationError` |
| 4 | `initialize({ auth: { jwtSecret: '' } })` | `ConfigurationError` 전파 |
| 5 | `initializeStorage()` 에 `bucketName` 누락, `initializeCors({ allowedOrigins: [] })` | 각각 `bucketName is required`, `allowedOrigins must not be empty` throw |
| 6 | `initializeAuth({ accessTokenExpiry: '24h' })` | `24h를 초과` 경고 미출력 (24h 초과일 때만 경고) |

- **자동화:** 가능 ✅ | **테스트 수:** 81개 (registry 20, auth-config 12, cache-config 8, common 5, cors-config 7, errors 4, geolocation-config 5, logger-config 5, storage-config 9, initialize 6)

---

### TC-U-014: AppError 와 오류 코드 체계

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-012 |
| **파일** | `__tests__/unit/error/app-error.test.ts`, `__tests__/unit/error/error-codes.test.ts` |
| **대상** | `src/core/error/app-error.ts`: `AppError`, `AppError.from()`, 팩토리 메서드 / `src/core/constants/error-codes.ts`: `getHttpStatus()`, `getErrorCategory()`, `getAllErrorCodes()`, `formatErrorMessage()` |
| **우선순위** | High |
| **전제조건** | 없음 |
| **테스트 데이터** | 코드 `40401`, 경계값 `60000`, 보안 카테고리 `40371`·`40376` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `AppError.from(new Error('General error'))` | `AppError` 인스턴스, `status: 500` |
| 2 | `new AppError(40401, ..., { field: 'id' })` 에 requestId 지정 후 `toJSON()` | `code: 40401`, `status: 404`, `category: 'resource'`, `requestId`, `details.field` 포함 |
| 3 | `new AppError(60000)` | code 가 `INTERNAL_SERVER_ERROR` 코드로 대체 |
| 4 | `AppError.validation('Invalid input')` | `status: 400`, `category: 'validation'` |
| 5 | `getAllErrorCodes()` 전체 순회 | 모든 코드가 5자리 |
| 6 | `getErrorCategory(40371)`, `getHttpStatus(40001)` | `'security'`, `400` |

- **자동화:** 가능 ✅ | **테스트 수:** 119개 (app-error 76, error-codes 43)

---

### TC-U-015: 다국어 오류 메시지와 로케일 감지

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-012 |
| **파일** | `__tests__/unit/error/error-messages.test.ts`, `__tests__/unit/error/friendly-messages-v2.test.ts`, `__tests__/unit/error/locale-detector.test.ts` |
| **대상** | `src/core/error/messages/index.ts`: `getErrorMessage()`, `isLocaleSupported()` / `src/core/error/friendly-messages-v2.ts`: `getErrorDisplayInfo()`, `formatFriendlyError()` / `src/next/error/locale-detector.ts`: `LocaleDetector` |
| **우선순위** | Medium |
| **전제조건** | 클라이언트 감지 케이스는 `global.window`·`localStorage`·`navigator` 를 테스트에서 직접 정의 (jsdom 미사용) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `getErrorMessage(40001, 'ja')` 와 `'ko'` 비교 | title·description 동일 (ja 는 ko 메시지로 폴백) |
| 2 | `isLocaleSupported('KO')` | `false` |
| 3 | `getErrorDisplayInfo(40371, 'ko')` | `severity: 'critical'`, `icon: '🛡️'` |
| 4 | `formatFriendlyError(40001, 'ko')` | `'입력 정보를 확인해 주세요 - 입력하신 정보 중 일부가 올바르지 않습니다. [40001]'` |
| 5 | 쿠키 locale `'xx'`, accept-language `en-US` 로 `detectServer()` | `'en'` |
| 6 | `cookies.get` 이 throw 하는 요청으로 `detectServer()` | `'ko'` |

- **자동화:** 가능 ✅ | **테스트 수:** 77개 (error-messages 25, friendly-messages-v2 26, locale-detector 26)

---

### TC-U-016: 오류 분류 (classifyError)와 Next 오류 핸들러

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-013 |
| **파일** | `__tests__/unit/error/classify-error.test.ts`, `__tests__/unit/error/error-handler.test.ts` |
| **대상** | `src/core/constants/error-codes.ts`: `classifyError()` / `src/next/error/error-handler.ts`: `processError()`, `errorToResponse()`, `withErrorHandler()`, `AUTH_ERROR_CODE_MAP`, `ErrorResponse` |
| **우선순위** | Critical |
| **전제조건** | logger mock |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | errno `ECONNREFUSED` 를 가진 Error 로 `classifyError()` | `EXTERNAL_SERVICE_ERROR`, `status: 503` |
| 2 | 인식되지 않는 메시지 `'Something unexpected happened'` | `SERVER_ERROR`, `status: 500` |
| 3 | `JWTError('...', 'TOKEN_EXPIRED')` 를 `processError()` | `TOKEN_EXPIRED` 코드(40103), `status: 401` |
| 4 | `PasswordError('Hash failed', 'PASSWORD_HASH_FAILED')` 를 `processError()` | `SERVER_ERROR`, `status: 500` (400 아님) |
| 5 | `AUTH_ERROR_CODES` 전체와 `AUTH_ERROR_CODE_MAP` 키 비교 | 모든 키가 매핑에 존재 |
| 6 | `AppError.notFound()` 를 `errorToResponse(error, '/api/items/123')` | `logger.warn('Client error', { path, status: 404 })` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 104개 (classify-error 29, error-handler 75)

---

### TC-U-017: ErrorProcessor 와 오류 메시지 포매터

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-013 |
| **파일** | `__tests__/unit/utils/error-processor.test.ts`, `__tests__/unit/utils/error-message-formatter.test.ts` |
| **대상** | `src/next/utils/error-processor.ts`: `ErrorProcessor.process()`, `toResponse()`, `withErrorHandling()`, `handlePrismaError()`, `throw*Error()` / `src/core/utils/error-message-formatter.ts`: `formatRedisError()`, `formatDatabaseError()`, `formatGenericError()` |
| **우선순위** | High |
| **전제조건** | logger mock |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `ErrorProcessor.process(null)` | `status: 500` |
| 2 | 메시지 `'P2003: Foreign key constraint failed'` 로 `process()` | `status: 400`, `details: { prismaCode: 'P2003' }` |
| 3 | `handlePrismaError({ code: 'P2003' })` | `status: 400`, `VALIDATION_ERROR` 코드 (40001, 매핑표 기준이며 `BUSINESS_RULE_VIOLATION` 아님) |
| 4 | `withErrorHandling(handler, { maskSensitiveInfo: true })` 에서 details 가 있는 AppError throw | 응답 `error` 에 `details` 없음 |
| 5 | `customErrorHandler` 자체가 throw | 기본 처리로 폴백해 `status: 500` |
| 6 | `formatRedisError('max requests limit exceeded Limit: 10000 Usage: 10001')`, `formatGenericError('x'×200)` | `Redis request limit exceeded`·`10K` 포함, 길이 153 + `...` 로 끝남 |

- **자동화:** 가능 ✅ | **테스트 수:** 72개 (error-processor 49, error-message-formatter 23)
- **결함 이력:** 2026-09-13 판에서 단계 3 은 `status: 422`, `BUSINESS_RULE_VIOLATION` 을 단언해 같은 P2003 에 대해 단계 2 (400)와 결과가 달랐고, 테스트 이름 `maps P2003 to 400 bad request (business rule)` 과도 어긋났다. 2026-09-16 커밋 `c07a669` 에서 `handlePrismaError()` 가 공통 매핑표를 따르도록 수정하면서 테스트 이름을 `maps P2003 to 400 per the shared Prisma error map (not 422)` 로, 단언을 400 으로 바꿨다. 매핑표 14개 코드 전수 계약은 TC-U-027 이 소유한다.

---

### TC-U-018: Prisma 오류 분류와 로그 길이 제한

2026-09-13 커밋 `fb07def` (`fix(error): Prisma 오류를 code 속성 기준으로 분류하고 로그 길이 제한`)에서 추가된 모듈과 테스트이다. 사전 조사 문서의 우선순위 갭 8번 항목을 이 케이스로 문서화한다.

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-014 |
| **파일** | `__tests__/unit/error/prisma-error-classification.test.ts` |
| **대상** | `src/core/error/prisma-error.ts`: `inspectPrismaError()`, `getPrismaErrorCode()`, `isPrismaValidationError()`, `getPrismaErrorMapping()`, `PRISMA_ERROR_MAP`, `PRISMA_MESSAGE_SCAN_LIMIT` (200) / `src/core/constants/error-codes.ts`: `classifyError()`, `classifyPrismaError()` / `src/next/utils/error-processor.ts`: `ErrorProcessor.process()`, `toResponse()` / `src/next/error/error-handler.ts`: `processError()` / `src/core/error/extract-error-info.ts`: `truncateErrorMessage()`, `summarizeErrorForLog()`, `ERROR_LOG_MESSAGE_MAX_LENGTH` (500) |
| **우선순위** | Critical |
| **전제조건** | logger·`next/server` mock, Prisma 7 오류 클래스를 이름(`name`)과 `code` 속성으로 모사한 더블 사용 |
| **테스트 데이터** | 아래 분류 기준표, 난독화 번들 소스 모사 문자열 (`"P2011"`, `"unauthorized"`, `"record not found"` 와 4,000자 패딩 포함) |

**분류 기준표** (`PRISMA_ERROR_MAP` 과 `classifyPrismaError()` 기준)

| 입력 | 표준 코드 | HTTP 상태 | 이 파일의 단언 여부 |
|------|----------|----------|-------------------|
| `code: 'P2002'` | 40905 `DUPLICATE_RESOURCE` | 409 | 단언함 (`classifyError`, `ErrorProcessor.process`, `processError`) |
| `code: 'P2025'` | 40401 `NOT_FOUND` | 404 | 매핑표 값 `PRISMA_ERROR_MAP.P2025.status === 404` 만 단언함 |
| `code: 'P2011'` | 40004 `MISSING_REQUIRED_FIELD` | 400 | 단언하지 않음 (번들 소스 문자열에 섞인 잡음으로만 사용) |
| `PrismaClientValidationError` (code 없음) | 40001 `VALIDATION_ERROR` | 400 | 단언함 (401 이 아님을 함께 단언) |
| 매핑되지 않은 코드 (`P2010`, `P9999`) | 50003 `DATABASE_ERROR` | 500 | 단언함 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 메시지에 번들 소스가 들어 있고 `code: 'P2002'` 인 오류를 `inspectPrismaError()` | `code: 'P2002'`, `source: 'property'`, `kind: 'known-request'` |
| 2 | 메시지 본문에 `P2025` 가 있고 `code: 'P2002'` 인 오류를 `ErrorProcessor.process()`·`processError()` | 두 경로 모두 `status: 409`, `code: 40905`, process 는 `details: { prismaCode: 'P2002' }` |
| 3 | `PrismaClientValidationError` 를 `classifyError()`·`ErrorProcessor.process()`·`processError()` | 세 경로 모두 `status: 400` (401 아님), process 는 `key: 'VALIDATION_ERROR'` |
| 4 | 250자·300자 패딩 뒤에만 `P2002` 가 있는 일반 Error 를 각각 `inspectPrismaError()`·`process()` | `null`, `status: 500` + `key: 'SERVER_ERROR'` (앞 200자만 스캔) |
| 5 | 매핑되지 않은 `P9999` 오류를 `process()` | `logger.error('Unmapped Prisma error', { prismaCode: 'P9999' })`, 기록 메시지 길이 ≤ 540 이고 `[truncated` 포함 |
| 6 | 500자 + 3,000자 문자열을 `truncateErrorMessage()` | 원문보다 짧고 `[truncated 3000 chars]` 포함 |

- **자동화:** 가능 ✅ | **테스트 수:** 25개 (현재)
- **관련 커밋:** `fb07def` (0.15.0 에 포함). 호스트 응답이 P2002 → 409, P2025 → 404 로 세분화되고 P2011 이 500 에서 400 으로 바뀌므로 호스트 재검증이 필요하다.

---

### TC-U-019: geolocation 기본 공급자와 배치 처리

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-015 |
| **파일** | `__tests__/unit/geolocation/geolocation.test.ts` |
| **대상** | `src/core/geolocation/providers/base-provider.ts`: `BaseGeoIPProvider`, `truncateString()` / `src/core/geolocation/batch-processor.ts`: `BatchProcessor` |
| **우선순위** | Medium |
| **전제조건** | `global.fetch` mock, 테스트용 하위 클래스 `MockGeoIPProvider` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | fetch 가 `{ ok: false, status: 404 }` 반환 시 `fetchGeoData('invalid-ip')` | `null` |
| 2 | `fetchGeoData('8.8.8.8')` 호출 | fetch 두 번째 인자에 `signal: AbortSignal` 포함 |
| 3 | `{ country: 'United States' }` 만 있는 응답을 `parseResponse()` | `country: 'United States'`, `city: null` |
| 4 | 처음 2회 실패 후 성공하는 프로세서로 `processBatchWithRetry([1, 2, 3])` | `successful: 3`, 시도 3회 |
| 5 | 6개 항목 중 마지막 배치만 실패하는 `processBatchConcurrent()` | `successful: 5`, `failed: 1` |
| 6 | `truncateString('Hello World', 5)` | `'Hello'` |

- **자동화:** 가능 ✅ | **테스트 수:** 30개 (현재)
- **비고:** 공급자 구현 4종(ip-api, ipapi-co, ipgeolocation, maxmind)은 커버리지 0% 이다 (TC-U-030).

---

### TC-U-020: 로거 요청·응답 기록

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-016 |
| **파일** | `__tests__/unit/logger/logger.test.ts` |
| **대상** | `src/core/logger/logger.ts`: `logger`, `logApiRequest()`, `logApiResponse()` |
| **우선순위** | Medium |
| **전제조건** | `winston`·`winston-daily-rotate-file` mock, 본문 읽기가 비동기이므로 150ms 대기 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `password` 필드가 있는 JSON 요청을 `logApiRequest()` | debug 로그에 이메일은 남고 비밀번호 원문은 없으며 `[MASKED]` 포함 |
| 2 | 2,000자 text/plain 본문 요청 | 로그에 `[TRUNCATED]` 포함, 원문 길이 + 500 미만 |
| 3 | 파싱할 수 없는 JSON 본문 요청 | 오류 없이 `[API Req]` 로그 출력 |

- **자동화:** 가능 ✅ | **테스트 수:** 25개 (현재)

---

### TC-U-021: R2 스토리지

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-017 |
| **파일** | `__tests__/unit/storage/r2-storage.test.ts` |
| **대상** | `src/core/storage/r2-storage.ts`: `isR2Enabled()`, `uploadToR2()`, `getFromR2()`, `deleteFromR2()` |
| **우선순위** | Medium |
| **전제조건** | `@aws-sdk/client-s3` 의 `send` mock |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 스토리지 미설정 상태에서 `uploadToR2()` | `AppError`, `SERVICE_UNAVAILABLE` 코드, `status: 503`, 메시지에 `R2 storage is not configured` |
| 2 | `send` 가 name `NoSuchKey` 오류로 reject 할 때 `getFromR2()` | `null` |
| 3 | `send` 가 `Network error` 로 reject 할 때 `getFromR2()` | 같은 오류로 reject |

- **자동화:** 가능 ✅ | **테스트 수:** 14개 (현재)

---

### TC-U-022: 시스템 환경 점검과 헬스체크

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-018 |
| **파일** | `__tests__/unit/system/system.test.ts`, `__tests__/unit/system/system-utils.test.ts`, `__tests__/unit/system/health-check.test.ts`, `__tests__/unit/system/environment.test.ts` |
| **대상** | `src/core/system/environment.ts`: `checkEnvironmentVariables()` / `health-check.ts`: `checkServiceHealth()` / `utils.ts`: `runCommandWithTimeout()`, `runSafeCommand()`, `formatBytesPerSec()`, `convertToBytes()` |
| **우선순위** | Medium |
| **전제조건** | `child_process`·`util`·`os` 모듈 mock, Prisma 클라이언트는 `$queryRaw` 페이크 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `initializeAuth({ jwtSecret })` 후 `checkEnvironmentVariables()` | `JWT_SECRET` 값이 `'***'`, 결과 전체에 시크릿 앞 8자 없음 |
| 2 | `$queryRaw` 가 `Connection refused` 로 reject 할 때 `checkServiceHealth(prisma)` | Database 항목 `status: 'error'`, 메시지에 `데이터베이스 연결 실패` |
| 3 | `checkRedisConnection` 이 reject 할 때 `checkServiceHealth()` | Redis 항목 `status: 'error'`, 메시지에 `Redis 연결 실패` |
| 4 | 끝나지 않는 명령으로 `runCommandWithTimeout('slow-cmd', 10)` | `Command timeout` reject, error 로그 |
| 5 | 1차 명령 실패 후 fallback 성공 `runSafeCommand()` | `'fallback result'` 반환 |
| 6 | 캐시 설정 미초기화 상태에서 `checkEnvironmentVariables()` | `CACHE_ENABLED`·`REDIS_REST_URL`·`REDIS_REST_TOKEN` 모두 `ok: false` |

- **자동화:** 가능 ✅ | **테스트 수:** 82개 (system 27, system-utils 32, health-check 12, environment 11)
- **비고:** `system.test.ts` 와 `system-utils.test.ts`·`health-check.test.ts` 는 `formatBytesPerSec`·`convertToBytes`·`checkServiceHealth` 를 중복 검증한다. 수집기 `cpu.ts`·`disk.ts`·`memory.ts`·`network.ts` 는 커버리지 0% 이다.

---

### TC-U-023: 입력 검증과 새니타이저

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-019 |
| **파일** | `__tests__/unit/utils/input-validation.test.ts`, `__tests__/unit/utils/sanitizer.test.ts` |
| **대상** | `src/core/utils/input-validation.ts`: `validateURL()`, `detectXSS()`, `detectPathTraversal()`, `detectSQLInjection()`, `sanitizeInput()`, `validateFilename()`, `validateInput()` / `src/core/utils/sanitizer.ts`: `sanitizeHtml()`, `removeEventHandlers()`, `sanitizeUrl()` |
| **우선순위** | High |
| **전제조건** | 없음 (순수 함수) |
| **테스트 데이터** | `http://[::ffff:127.0.0.1]/`, `http://169.254.169.254/latest/meta-data/`, `http://2130706433`, `&#60;script&#62;alert(1)&#60;/script&#62;` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `validateURL('http://[::ffff:127.0.0.1]/')` | `valid: false` (IPv4-mapped IPv6 우회 차단) |
| 2 | `validateURL('http://169.254.169.254/latest/meta-data/')` | `valid: false`, error 에 `Internal URLs` |
| 3 | `validateURL('http://2130706433')` | `valid: false` (10진수 표기 loopback) |
| 4 | `detectSQLInjection('Please update your profile information')` | `false` (일반 문장 오탐 방지) |
| 5 | `validateInput('Hello <b>world</b>', 'html')` | `valid: true`, `sanitized: 'Hello &lt;b&gt;world&lt;/b&gt;'` |
| 6 | `sanitizeHtml('&#60;script&#62;alert(1)&#60;/script&#62;')` | `'alert(1)'` |

- **자동화:** 가능 ✅ | **테스트 수:** 134개 (input-validation 94, sanitizer 40)
- **비고:** `unit/utils/sanitizer.test.ts` (40건)는 `security/utils/sanitizer.test.ts` (41건)와 이름과 단언이 거의 같다. 보안 파일에만 `should remove unquoted event handler values` 1건이 더 있다.

---

### TC-U-024: URL 정규화와 IP 유틸

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-020 |
| **파일** | `__tests__/unit/utils/url-normalizer.test.ts`, `__tests__/unit/utils/ip-utils.test.ts` |
| **대상** | `src/core/utils/url-normalizer.ts`: `normalizeUrl()`, `validateUrl()`, `hasValidScheme()`, `getUrlType()` / `src/core/utils/ip-utils.ts`: `extractClientIp()`, `isPrivateIP()`, `isValidIP()`, `normalizeIP()` |
| **우선순위** | High |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `normalizeUrl('javascript:alert(1)')`, `('data:text/html,evil')` | 둘 다 `''` |
| 2 | 2,100자 경로를 가진 URL 로 `validateUrl()` | `isValid: false`, `messageKey: 'urlTooLong'` |
| 3 | `x-forwarded-for: 1.2.3.4, 5.6.7.8, 9.10.11.12` 로 `extractClientIp()` | `'9.10.11.12'` (프록시가 추가한 마지막 IP) |
| 4 | `x-real-ip` 만 있는 헤더로 `extractClientIp()` | `null` (위조 가능 헤더 무시) |

- **자동화:** 가능 ✅ | **테스트 수:** 89개 (url-normalizer 53, ip-utils 36)

---

### TC-U-025: 형식 변환·타입 가드·생성기·낙관적 잠금·기동 배너

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-021 |
| **파일** | `__tests__/unit/utils/type-guards.test.ts`, `timezone.test.ts`, `short-code-generator.test.ts`, `format-number.test.ts`, `startup-banner.test.ts`, `optimistic-lock.test.ts` (모두 `__tests__/unit/utils/` 아래) |
| **대상** | `src/core/utils/`: `type-guards.ts`, `timezone.ts` (`getRelativeTime()` 등), `short-code-generator.ts` (`generateShortCode()`, `generateUniqueShortCode()`), `format-number.ts` (`formatNumber()`), `startup-banner.ts` (`mask()`, `printStartupBanner()`), `optimistic-lock.ts` (`withOptimisticLock()`) |
| **우선순위** | Medium |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 자기 참조 객체로 `isJSONSerializable()` | `false` |
| 2 | 14일 전 날짜로 `getRelativeTime()` | `'2w ago'` |
| 3 | 항상 중복을 보고하는 `checkDuplicate` 와 `maxAttempts: 5` 로 `generateUniqueShortCode()` | `Failed to generate unique shortCode` reject |
| 4 | `formatNumber(15500000)` | `'15.5M'` |
| 5 | `mask('supersecretvalue', 'secret')` (색상 코드 제거 후) | `'✓ supe***'` |
| 6 | `updateFn` 이 `{ count: 0 }` 반환 시 `withOptimisticLock(updateFn)` | `AppError`, `code: 40904`, `status: 409` |

- **자동화:** 가능 ✅ | **테스트 수:** 186개 (type-guards 90, timezone 31, short-code-generator 29, format-number 17, startup-banner 12, optimistic-lock 7)
- **비고:** `short-code-generator.test.ts` 의 `should not contain ambiguous characters` 는 `toBeDefined()` 만 단언하므로 이름이 뜻하는 검증을 수행하지 않는다.

---

### TC-U-026: utils 다중 모듈 회귀 스위트

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-022 |
| **파일** | `__tests__/unit/utils/utils.test.ts` |
| **대상** | `src/core/utils/`: `url-normalizer.ts`, `short-code-generator.ts`, `ip-utils.ts`, `sanitizer.ts`, `format-number.ts`, `timezone.ts` |
| **우선순위** | Low |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `SUPPORTED_SCHEMES` 확인 | `javascript:`, `data:`, `file:` 미포함 |
| 2 | `generateShortCode(8)` 10,000회 | 고유 코드 9,900개 초과 |
| 3 | `x-forwarded-for` 3개 IP 헤더로 `extractClientIp()` | 마지막 IP `'9.10.11.12'` |

- **자동화:** 가능 ✅ | **테스트 수:** 133개 (현재)
- **비고:** 이 파일은 TC-U-023·024·025 의 모듈별 파일과 대상이 겹치는 회귀 묶음이므로 우선순위를 Low 로 둔다. 테스트 이름의 `TC-UNIT-URL/SC/IP/SAN/FMT/TZ` ID 는 출처 문서가 저장소에 없다.

---

### TC-U-027: Prisma 매핑표 전 코드 계약과 handlePrismaError 경로 일치

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-023 |
| **파일** | `__tests__/unit/error/prisma-error-map-contract.test.ts` |
| **대상** | `src/core/error/prisma-error.ts`: `PRISMA_ERROR_MAP` (14개 코드), `PRISMA_VALIDATION_MESSAGE` / `src/core/constants/error-codes.ts`: `getHttpStatus()` / `src/next/error/error-handler.ts`: `processError()` / `src/next/utils/error-processor.ts`: `ErrorProcessor.process()`, `handlePrismaError()` |
| **우선순위** | High |
| **전제조건** | logger·`next/server` mock (`NextResponse.json` 이 status 와 body 를 돌려주는 더블), `name: 'PrismaClientKnownRequestError'` 와 `code` 속성을 가진 오류 더블, `name: 'PrismaClientValidationError'` 오류 더블 |
| **테스트 데이터** | `P2011`, `P2025`, `P2003`, `P2002`, `P9999`, `PRISMA_ERROR_MAP` 전체 키 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `PRISMA_ERROR_MAP` 의 14개 코드마다 `getHttpStatus(mapping.code)` | 매핑표의 `status` 와 같음 |
| 2 | `code: 'P2011'` 오류를 `processError()`·`ErrorProcessor.process()` | 둘 다 `code: 40004`, `status: 400`, 후자는 `details: { prismaCode: 'P2011' }` |
| 3 | 메시지에 `not found` 가 없는 `code: 'P2025'` 오류를 `processError()` | `code: 40401`, `status: 404` (메시지 폴백이 아닌 code 속성 경로) |
| 4 | 14개 코드를 순회하며 `processError()`·`process()`·`handlePrismaError()` 결과 비교 | 세 경로 모두 매핑표의 `code`·`status`·`message` 와 같음, `handlePrismaError()` 본문은 `{ success: false, error: { code, message } }` |
| 5 | `handlePrismaError({ code: 'P2011' })`, `handlePrismaError({ code: 'P2003' })` | 둘 다 `status: 400`, P2003 결과가 `process()` 와 같고 `BUSINESS_RULE_VIOLATION` 이 아님 |
| 6 | `PrismaClientValidationError` 를 `handlePrismaError()` | `status: 400`, `VALIDATION_ERROR` (40001), 메시지 `PRISMA_VALIDATION_MESSAGE`. `processError()`·`process()` 도 400 |
| 7 | `handlePrismaError({ code: 'P9999' })`, `handlePrismaError({ code: 'P2002' })` 본문 | 전자는 `status: 500`, `DATABASE_ERROR`. 후자 본문에는 `details` 와 `P2002` 문자열이 없음 |

- **자동화:** 가능 ✅ | **테스트 수:** 37개 (매핑표 자체 일관성 15, processError·process 3, 세 경로 비교 14, handlePrismaError 5)
- **결함 이력:** 2026-09-13 판에서는 계획 TC 였고, `handlePrismaError()` 결과를 계약으로 둘지 결정이 필요하다고 기록했다. 당시 `handlePrismaError()` 는 `PRISMA_ERROR_MAP` 을 쓰지 않고 P2002·P2025·P2003 만 개별 분기했다. 그래서 P2011 은 `DATABASE_ERROR` (50003, 500), P2003 은 `BUSINESS_RULE_VIOLATION` (42201, 422), `PrismaClientValidationError` 는 500 으로 응답했고, P2002·P2025 도 매핑표 문구 대신 `ERROR_CODES` 기본 영문 메시지를 반환했다. 2026-09-16 에 이 파일을 먼저 작성해 17건 실패(세 경로 비교 14건, handlePrismaError 3건)를 확인했다. 이어서 커밋 `c07a669` 에서 `ErrorProcessor` 의 Prisma 변환을 모듈 함수 `resolvePrismaError()` 로 추출해 `handlePrismaError()` 와 공유하도록 수정했다.
- **결정:** 매핑표를 단일 기준으로 삼아 상태 코드·에러 코드·메시지를 세 경로에서 모두 같게 한다. `handlePrismaError()` 의 응답 본문 형태는 유지하고, 응답에 Prisma 내부 코드(`details.prismaCode`)는 싣지 않는다.

---

### TC-U-028: CSV 내보내기 실제 소스 검증

2026-09-16 에 `__tests__/unit/utils/csv-export.test.ts` 를 소스를 직접 import 해 실행하는 테스트로 교체했다. 교체 과정에서 드러난 파일명 인코딩 결함도 함께 수정했다.

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-024 |
| **파일** | `__tests__/unit/utils/csv-export.test.ts` |
| **대상** | `src/next/utils/csv-export.ts`: `escapeCsvField()`, `rowToCsv()`, `createCsvHeader()`, `createSimpleCsvResponse()`, `createStreamingCsvResponse()`, `dateFormatter`, `boolFormatter`, 내부 `buildContentDisposition()` / `src/next/utils/csv-export-format.ts`: `customDateFormatter()` |
| **우선순위** | High |
| **전제조건** | logger mock, `next/server` 는 devDependency 실모듈 사용, 응답 테스트는 `Date` 만 가짜 타이머로 `2026-09-15T08:00:00Z` 에 고정, 본문은 `arrayBuffer()` 바이트로 읽음 (`Response.text()` 는 BOM 을 제거함) |
| **테스트 데이터** | `columns: [{ header: '이름', accessor: 'name' }]`, 행 `{ name: '홍길동' }`, 스트리밍 fetcher 2배치 (2행 + `nextCursor: 'c1'`, 1행), 파일명 `users`·`회원목록`·`주문내역`·`report "Q3"`·`a\r\nX-Injected: 1` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `escapeCsvField('a"b')`, `escapeCsvField(null)`, `escapeCsvField('a,b\nc')` | `'"a""b"'`, `'""'`, `'"a,b\nc"'` |
| 2 | `createSimpleCsvResponse([{ name: '홍길동' }], { filename: 'users', columns })` | 본문 바이트가 BOM(`EF BB BF`)으로 시작하고 이어서 `"이름"\r\n"홍길동"`, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="users_2026-09-15.csv"` |
| 3 | 같은 호출에 `includeBom: false` | 본문이 BOM 없이 시작 |
| 4 | `createStreamingCsvResponse({ batchSize: 2, fetcher })` 본문 끝까지 읽기 | 헤더 + 3행, fetcher 2회 (`undefined`, `'c1'`), `Transfer-Encoding: chunked`, 완료 로그 `totalCount: 3`·`batchCount: 2` |
| 5 | fetcher 가 throw 하는 스트리밍 응답 본문 읽기 | 읽기가 `db down` 으로 reject, `logger.error('Streaming CSV export error', ...)` |
| 6 | `boolFormatter.korean(true)`, `customDateFormatter(null, 'yyyy-MM-dd')`, `customDateFormatter(date, 'j')` | `'예'`, `''`, `date.toISOString()` (date-fns 가 거부한 형식의 폴백) |
| 7 | 파일명 `회원목록` 으로 `createSimpleCsvResponse()`, `주문내역` 으로 `createStreamingCsvResponse()` | 응답 생성 성공, `Content-Disposition: attachment; filename="_____2026-09-15.csv"; filename*=UTF-8''%ED%9A%8C%EC%9B%90%EB%AA%A9%EB%A1%9D_2026-09-15.csv`, 스트리밍 본문도 끝까지 읽힘 |
| 8 | 파일명 `report "Q3"`, `a\r\nX-Injected: 1` | 대체 이름의 따옴표는 `_` 로 치환하고 `filename*` 에 원래 이름을 실음, 줄바꿈 파일명으로 `X-Injected` 헤더가 생기지 않음 |

- **자동화:** 가능 ✅ | **테스트 수:** 43개 (이스케이프 7, 행·헤더 4, 날짜 포맷터 10, 불리언 포맷터 10, 단순 응답 4, 스트리밍 응답 4, 파일명 인코딩 4)
- **결함 이력 (허위 양성):** 2026-09-13 판의 이 파일(29건)은 `NextResponse` 의존을 피하려고 같은 함수를 테스트 파일 안에 다시 구현해 검증했으므로 소스를 실행하지 않았고, 커버리지 실측에서 `csv-export.ts` 가 0% 였다. 복제본 `boolFormatter.korean(true)` 는 `'Yes'` 를 반환해 소스의 `'예'` 와 달랐고, 복제본에 있던 `dateFormatter.custom` 은 이미 소스에서 `customDateFormatter()` 로 분리된 뒤였다. 2026-09-16 커밋 `e37468c` 에서 소스 import 방식으로 교체했다 (39건). 이 파일만 실행해도 `csv-export.ts`·`csv-export-format.ts` 커버리지가 100% 였다.
- **결함 이력 (파일명 인코딩):** 교체 테스트로 실제 소스를 실행하자, 파일명에 한글 같은 비 ASCII 문자가 있으면 두 응답 함수가 `TypeError: Cannot convert argument to a ByteString` 으로 실패하는 결함이 드러났다. HTTP 헤더 값은 ByteString 이어야 하는데 파일명을 `Content-Disposition` 에 그대로 넣었기 때문이다. 줄바꿈이 있는 파일명도 `Headers.append` 의 `TypeError` 로 실패했다. 단계 7·8 의 4건을 먼저 추가해 4건 실패를 확인한 뒤, 커밋 `535faec` 에서 수정했다. 따옴표·역슬래시가 없는 출력 가능 ASCII 이름은 기존 형식을 그대로 유지하고, 그 밖의 이름은 ASCII 대체 이름과 RFC 5987 `filename*` 을 함께 싣는다.
- **비고:** 파일명 날짜는 `new Date().toISOString()` 의 UTC 날짜이므로 한국 시간 00:00~09:00 에 내려받으면 전날 날짜가 붙는다. 동작 변경 여부가 결정되지 않아 수정하지 않았다.

---

### TC-U-029: withCache 래퍼와 캐시 무효화 헬퍼

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-025 |
| **파일** | `__tests__/unit/cache/cache-wrapper.test.ts` |
| **대상** | `src/core/cache/cache-wrapper.ts`: `withCache()`, `getCacheBackendLabel()` / `src/core/cache/cache-invalidation.ts`: `invalidateCache`, `deleteFromCache()`, `deletePatternFromCache()`, `deletePatternFromMultipleCaches()` |
| **우선순위** | Medium |
| **전제조건** | logger, `cache-factory` (`getCacheManager`, `getEffectiveCacheBackend`, `cache`, `geoCache`), `cache-env` (`isCacheEnabled`), `cache-config` (`getCacheConfig: {}`, `getCacheTTL.default()` 가 600) 를 `vi.mock` 으로 대체 |
| **테스트 데이터** | 키 `'community:recent'`, `'plain'`, `'k'`, `options.ttl = 5`, `options.prefix = 'community'`, 매니저 페이크 `{ get, set }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 캐시 미스 상태에서 `withCache('community:recent', fetch)` | `getCacheManager('community')`, `get('recent')`, fetch 1회, `set('recent', 값, 600)` |
| 2 | `get` 이 값을 반환하는 상태에서 호출 | fetch·`set` 미호출, 캐시 값 반환 |
| 3 | fetch 가 `null` 을 반환할 때 `withCache('k', fetch, { ttl: 5 })` 후 적중 | `set('k', { __nullValue__: true }, 5)`, 적중 시 fetch 없이 `null` 반환 |
| 4 | 접두사 없는 키 `'plain'`, `prefix: 'community'` 옵션, 전역 캐시 비활성 | 각각 `getCacheManager('default')`, `getCacheManager('community')` 와 원래 키 사용, 매니저 없이 fetch 1회 |
| 5 | 미스 경로에서 fetch 가 throw (첫 호출만 실패하는 fetch 포함) | fetch 1회, 같은 오류로 reject, `set` 미호출 |
| 6 | fetch 성공 후 `set` 이 throw, 또는 저장 로그의 직렬화(`BigInt` 값)가 throw | fetch 1회, 첫 fetch 결과 반환, `set` 실패는 `logger.error` 로 기록 |
| 7 | `get` 이 throw, 또는 `get` 과 fetch 가 모두 throw | 전자는 fetch 1회 결과 반환과 `logger.warn` (degrade), 후자는 fetch 1회 후 fetch 오류로 reject |
| 8 | `getCacheBackendLabel()` 을 백엔드 4종으로 호출 | `redis → R`, `memory → M`, `hybrid → H`, `none → N` |
| 9 | `deletePatternFromMultipleCaches([m1, m2], 'user:*')`, `deleteFromCache()`, `deletePatternFromCache()`, `invalidateCache.byKey/byPattern/all/geoByKey/allGeo` | 각 매니저에 1회씩 위임, `cache.deletePattern('*')`, `geoCache.deletePattern('*')` |

- **자동화:** 가능 ✅ | **테스트 수:** 19개 (정상 경로 6, 실패 경로 6, 백엔드 라벨 4, 무효화 헬퍼 3)
- **결함 이력:** 2026-09-13 판에서는 계획 TC 였고, 단계 5·6 의 현재 동작을 "fetch 총 2회" 로 기록했다. 당시 `withCache()` 는 캐시 조회·fetch·저장을 하나의 try 로 감싸고 catch 블록에서 원본 함수를 다시 호출했다. 그래서 fetch 가 throw 하거나 fetch 성공 뒤 `set`·저장 로그 직렬화가 실패하면 부수 효과가 있는 fetch 가 두 번 실행되었다. 2026-09-16 에 이 파일을 먼저 작성해 4건 실패(단계 5 의 2건, 단계 6 의 2건)를 확인했다. 이어서 커밋 `5ba8eff` 에서 캐시 조회 실패만 원본 함수 1회 실행으로 degrade 하고, 미스 경로의 fetch 오류는 그대로 전파하며, 저장 실패는 기록만 하도록 수정했다.
- **결정:** 원본 함수는 `withCache()` 호출당 최대 한 번만 실행한다.

---

### TC-U-030: GeoIP 공급자 구현 4종과 공급자 팩토리 🔲 계획

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-026 |
| **파일** | `__tests__/unit/geolocation/providers.test.ts` (신규) |
| **대상** | `src/core/geolocation/providers/ip-api-provider.ts`: `IPApiProvider` / `ipapi-co-provider.ts`: `IPApiCoProvider` / `ipgeolocation-provider.ts`: `IPGeolocationProvider` / `maxmind-provider.ts`: `MaxMindProvider` / `index.ts`: `GeoIPProviderFactory` (모두 커버리지 0%) |
| **우선순위** | Low |
| **전제조건** | geolocation 설정 초기화 여부를 테스트마다 제어 (`initializeGeolocation`, reset) |
| **테스트 데이터** | IP `8.8.8.8`, ip-api 응답 `{ status: 'success', countryCode: 'US', ... }`, ipapi.co 응답 `{ country_code: 'US', ... }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `new IPApiProvider().url('8.8.8.8')` | `http://ip-api.com/json/8.8.8.8?fields=...` |
| 2 | ip-api 응답 `status: 'success'` / `'fail'` 을 `parseResponse()` | 전자는 `country: 'US'`, `accuracy: 1000`, `isProxy: false`; 후자는 `null` |
| 3 | ipapi.co 응답에 `country_code` 가 없을 때 `parseResponse()` | `null` |
| 4 | geolocation 설정 미초기화 상태에서 `IPGeolocationProvider` 의 `url()`·`isAvailable()` | `''`, `false` |
| 5 | `ipgeolocationApiKey` 설정 후 `url('8.8.8.8')` | `apiKey` 와 `ip=8.8.8.8` 을 포함한 URL, 파싱 결과 `accuracy: 100` |
| 6 | `MaxMindProvider` 의 `url()`, `parseResponse({})` | `''`, `null` (소스 주석대로 미구현) |
| 7 | API 키가 없는 상태에서 `GeoIPProviderFactory.getOptimalProvider()` | 사용 가능한 ip-api (45/5000)와 ipapi.co (1000/5000) 중 `rateLimit / timeout` 이 큰 `ipapi.co` |

- **자동화:** 가능 ✅
- **선행 조건:** `GeoIPProviderFactory` 의 공급자 목록은 정적 필드이므로 `registerProvider()` 를 쓰는 케이스는 테스트 간 상태 오염을 막는 정리 절차가 필요하다.

---

### TC-U-031: 브라우저용 JWT 클라이언트 유틸 🔲 계획

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-U-027 |
| **파일** | `__tests__/unit/auth/jwt-client.test.ts` (신규) |
| **대상** | `src/core/auth/jwt/client.ts`: `JWTClientManager`, `getStoredTokens()`, `storeTokens()`, `decodeJWTPayload()`, `isTokenExpired()`, `getUserRole()`, `isTokenExpiringSoon()` (커버리지 0%) |
| **우선순위** | Low |
| **전제조건** | 브라우저 케이스는 파일 단위 `// @vitest-environment jsdom` 지정 (jsdom 은 devDependency 에 있음) |
| **테스트 데이터** | 저장 키 `jwt_tokens`, `exp` 가 과거·100초 뒤인 토큰, payload 에 `-`·`_` 가 들어간 base64url 토큰 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | node 환경(`window` 없음)에서 `getStoredTokens()`, `storeTokens('a', 'r')` | `null`, 저장하지 않고 반환 |
| 2 | jsdom 에서 `storeTokens('a', 'r', 60)` 후 `getStoredTokens()` | `localStorage['jwt_tokens']` 에 `expiresAt ≈ now + 60000`, 토큰 반환 |
| 3 | `expiresAt` 이 과거인 저장값으로 `getStoredTokens()` | `null`, 저장소에서 제거 |
| 4 | `decodeJWTPayload('a.b')` | `null` (세 부분이 아님) |
| 5 | `exp` 없는 토큰으로 `isTokenExpired()`, `getUserRole(null)` | `true`, `'USER'` (`ROLE_DEFAULTS.DEFAULT_ROLE`) |
| 6 | 남은 시간 100초 토큰으로 `isTokenExpiringSoon()` | `true` (기본 임계값 300초) |
| 7 | payload 세그먼트에 `-` 또는 `_` 가 포함된 토큰으로 `decodeJWTPayload()` | `atob()` 가 `InvalidCharacterError` 를 던져 `null` 반환 |

- **자동화:** 가능 ✅
- **선행 조건:** 단계 7 은 base64url 로 인코딩된 JWT 를 base64 전용 `atob()` 로 디코딩하는 현재 구현에서 나오는 결과이다. 결함으로 볼지 결정한 뒤 예상 결과를 확정한다.

---

## 2. Integration Tests (통합 테스트)

**목적:** 실제 모듈을 조합해 모듈 사이의 계약을 검증한다. 외부 저장소는 인메모리 페이크로 대체하되, 검증 대상 모듈은 실모듈을 사용한다.

**실행 명령:** `npm run test:integration`

2026-09-16 기준 이 도메인은 파일 3개·케이스 22건이다 (api-key 2, 캐시 계층 12, 인증 서비스와 토큰 저장소 8). 2026-09-13 판에서 소스를 전혀 실행하지 않던 `cache.integration.test.ts` 6건은 실제 모듈 조합 12건으로 교체했다.

---

### TC-I-001: api-key 모듈 간 해시 계약과 수명주기

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-I-001 |
| **파일** | `__tests__/integration/api-key/api-key-flow.integration.test.ts` |
| **대상** | `src/core/api-key/api-key.service.ts` + `key-generator.ts` + `validate.ts` 실조합 |
| **우선순위** | Critical |
| **전제조건** | Map 기반 인메모리 repo·cache 페이크 (`makeInMemoryDeps()`), 해시와 검증은 실모듈 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `generateApiKey('u1', { environment: 'production' }, 'PRO')` 가 반환한 원문 키로 `validateApiKey()` | `valid: true`, `user.id: 'u1'`, `apiKey.id` 가 발급 id 와 같음 |
| 2 | 같은 키를 검증해 캐시에 적재한 뒤 `deleteApiKey(id, 'u1')` | 삭제 성공 |
| 3 | 삭제한 키로 다시 `validateApiKey()` | `valid: false`, `error: 'INVALID_API_KEY'` (캐시 무효화 계약) |

- **자동화:** 가능 ✅ | **테스트 수:** 2개 (현재)
- **관련 문서:** [integration-gap-scenarios.md](../../__tests__/docs/scenarios/integration-gap-scenarios.md), [integration-gap-testcases.md](../../__tests__/docs/testcases/integration-gap-testcases.md)

---

### TC-I-002: 캐시 계층 실제 조합

2026-09-16 에 `__tests__/integration/cache.integration.test.ts` 를 실제 캐시 모듈을 조합하는 테스트로 교체했다.

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-I-002 |
| **파일** | `__tests__/integration/cache.integration.test.ts` |
| **대상** | `src/core/cache/config.ts`: `initializeCache()` + `cache-env.ts`·`cache-config.ts` + `cache-factory.ts`: `getCacheManager()`, `getEffectiveCacheBackend()`, `cache` + `inmemory-cache-manager.ts` + `hybrid-cache-manager.ts` + `noop-cache-manager.ts` + `cache-redis.ts`: `isRedisGloballyDisabled()`, `resetRedisGlobalState()` + `cache-wrapper.ts`: `withCache()`, `getCacheBackendLabel()` + `cache-invalidation.ts`: `deleteFromCache()`, `deletePatternFromMultipleCaches()`, `invalidateCache` |
| **우선순위** | High |
| **전제조건** | 케이스마다 `globalThis` 의 캐시 설정(`__withwiz_config`)·매니저 싱글턴·Redis 전역 상태를 지우고 `vi.resetModules()` 뒤 `initializeCache()` 를 호출한 다음 동적 import, logger mock, TTL 케이스는 `vi.useFakeTimers()`, 종료 시 `resetRedisGlobalState()`·`InMemoryCacheManager.destroyAll()` |
| **테스트 데이터** | `initializeCache({ enabled: true })` (redis 미지정이므로 Redis 비활성, inmemory 기본 활성), `{ enabled: false }`, `{ categories: { USER: { enabled: false } } }`, `{ fallback: { redisErrorThresholdGlobal: 100 } }`, 키 `'link:abc'`, 모든 메서드가 `Redis connection failed` 로 reject 하는 Redis 매니저 페이크 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `initializeCache({ enabled: true })` 후 `getEffectiveCacheBackend()`, `getCacheManager('link')` 두 번 | `'memory'`, 같은 `InMemoryCacheManager` 인스턴스, `getCacheBackendLabel()` 이 `'M'` |
| 2 | `withCache('link:abc', fetch)` 를 두 번 호출 | fetch 1회, 값이 `getCacheManager('link').get('abc')` 로 조회됨 |
| 3 | `deleteFromCache(getCacheManager('link'), 'abc')` 후 `withCache('link:abc', fetch)` | fetch 가 다시 호출됨 (총 2회) |
| 4 | `withCache('link:t', fetch, { ttl: 1 })` 후 900ms, 이어서 200ms 진행하며 재호출 | 900ms 시점은 적중 (fetch 1회), 1,100ms 시점은 만료로 fetch 재실행 |
| 5 | fetch 가 `null` 을 반환하는 키를 두 번 호출 | fetch 1회, 두 번 모두 `null` |
| 6 | 초기화 뒤 import 한 모듈로 `withCache('greeting')` 후 `invalidateCache.byKey('greeting')`, `deletePatternFromMultipleCaches([link, geo], 'user:*')` | `cache` 상수가 `getCacheManager('default')` 와 같고 무효화 뒤 fetch 재실행, 두 매니저의 `user:1` 삭제와 `keep` 유지 |
| 7 | `{ enabled: false }` 로 두 번 호출, `USER` 카테고리만 비활성으로 `user:u1`·`link:l1` 을 두 번씩 호출 | 전자는 `NoopCacheManager` 이고 fetch 2회, 후자는 user fetch 2회·link fetch 1회 |
| 8 | 전역 임계값 100 에서 Redis 가 모두 실패하는 `HybridCacheManager` 로 `set('abc')` 후 `get('abc')` | Redis `set`·`get` 호출 후 인메모리 값 반환, `isRedisGloballyDisabled()` 가 `false` |
| 9 | 기본 전역 임계값(1)에서 같은 조건 | 첫 `set` 오류로 `isRedisGloballyDisabled()` 가 `true`, `get` 은 Redis 를 호출하지 않고 인메모리 값 반환 |
| 10 | Redis 가 미스(`null`)를 반환하는 hybrid 매니저 | 인메모리 값 반환 |

- **자동화:** 가능 ✅ | **테스트 수:** 12개
- **결함 이력 (허위 양성):** 2026-09-13 판의 이 파일(6건)은 toolkit 소스를 하나도 import 하지 않았다. 테스트 파일 안에서 만든 `mockRedis` 객체와 `Map` 에 값을 넣고 그 값을 다시 단언했으므로, 소스가 바뀌어도 결과가 달라지지 않았다. 파일 주석이 근거로 든 `docs/testing/02-integration/02-cache.md` 는 저장소에 없었고, `TC-INT-CACHE-020` 이라는 ID 가 두 테스트에 중복으로 쓰였다. 2026-09-16 커밋 `610750c` 에서 원래 의도(저장·TTL·무효화·Redis 장애 시 인메모리 폴백)를 실제 모듈 기준으로 옮겼다. 이 파일만 실행해도 `cache-factory.ts` 커버리지가 58.53% 였다.
- **테스트로 고정하지 않은 동작 (결정 필요):**
  - 2026-09-13 판 단계 6 의 import 순서 문제는 그대로 남아 있다. `initializeCache()` 보다 먼저 `cache-factory` 를 import 하면 `export const cache = getCacheManager('default')` 가 `NoopCacheManager` 로 고정된다. 그러면 초기화 뒤에도 `cache.get('k')` 가 `null` 이고, 이 상수를 쓰는 `invalidateCache` 는 no-op 이 된다. 같은 시점에 `getCacheManager('default')` 를 호출하면 `InMemoryCacheManager` 를 반환한다. 2026-09-16 임시 테스트로 다시 확인했으며, 공개 상수의 평가 시점을 바꾸는 설계 결정이 필요하므로 수정하지 않았고 테스트로도 고정하지 않았다.
  - `initializeCache()` 없이 `withCache()` 를 호출하면 fetch 를 실행하지 않고 `ConfigurationError: [cache] Cache config not initialized. Call initializeCache() first.` 로 reject 한다. 같은 상황에서 `getCacheManager()` 는 경고 후 Noop 으로 degrade 하므로 두 정책이 다르다. 2026-09-16 임시 테스트로 확인했으며, 초기화 누락을 명시적 오류로 알릴지 degrade 할지 결정이 필요해 수정하지 않았다.

---

### TC-I-003: 인증 서비스와 캐시 기반 토큰 저장소 실제 조합

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-I-003 |
| **파일** | `__tests__/integration/auth/token-rotation-flow.integration.test.ts` |
| **대상** | `src/core/auth/services/login.service.ts`: `LoginService` + `token-refresh.service.ts`: `TokenRefreshService` + `cache-token-stores.ts`: `createCacheRefreshTokenStore()` (`markUsedIfUnused` 포함), `createCacheBlacklistChecker()` + `refresh-token-store.ts`: `IRefreshTokenStore` + `src/core/cache/inmemory-cache-manager.ts` + `src/core/auth/jwt/index.ts`: `JWTService` |
| **우선순위** | High |
| **전제조건** | Map 기반 UserRepository 페이크, `bcryptjs.hashSync(평문, 4)` 로 만든 실제 해시, `InMemoryCacheManager` 실인스턴스 (케이스 종료 시 `destroy()`), 기존 단위 테스트와 달리 store 를 Set 페이크로 대체하지 않음 |
| **테스트 데이터** | 시크릿 `'a'.repeat(32)`, 사용자 `{ id: 'user-1', isActive: true }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `login(email, pw, storedHash)` | `tokens.refreshToken` payload 에 `jti`·`familyId` 존재 (`createTokenPair()` 가 기본 부여) |
| 2 | 발급된 refresh 토큰 t1 으로 `refresh(t1)` | 새 refresh 토큰 t2 발급, 같은 `familyId`, 다른 `jti`, `store.isUsed(jti1)` 가 `true` |
| 3 | t1 재제출, 이어서 t2 로 `refresh()` | 전자는 `AuthError` code `TOKEN_REUSE_DETECTED` (401)이고 `store.isFamilyRevoked(familyId)` 가 `true`, 후자는 code `TOKEN_REVOKED` |
| 4 | 새 로그인 토큰으로 `revokeByToken()` 후 그 토큰으로 `refresh()` | code `TOKEN_REVOKED` |
| 5 | `createCacheBlacklistChecker(기록용 캐시).revokeAccessToken(accessToken, 60)` 후 조회 | `isAccessTokenRevoked(accessToken)` 가 `true`, 저장 키는 `revoked:at:<sha256(accessToken)>` 하나이고 원문 토큰 미포함 |
| 6 | 같은 refresh 토큰으로 `refresh()` 를 `Promise.allSettled` 로 동시에 2회 | 1건 성공, 1건 `TOKEN_REUSE_DETECTED`, family 무효화로 성공한 쪽의 새 토큰도 `TOKEN_REVOKED` |
| 7 | 같은 저장소를 공유하는 `TokenRefreshService` 인스턴스 2개가 동시에 갱신 | 1건만 성공 |
| 8 | 같은 토큰으로 동시에 5회 갱신 | 1건만 성공, 나머지 4건은 모두 `TOKEN_REUSE_DETECTED` |

- **자동화:** 가능 ✅ | **테스트 수:** 8개
- **결함 이력:** 2026-09-13 판에서는 계획 TC 였고, 같은 refresh 토큰으로 `refresh()` 를 동시에 두 번 호출하면 두 호출이 모두 성공하고 각각 새 토큰을 받는 동작을 "알려진 한계"로 기록만 했다. `isUsed` 확인과 `markUsed` 기록 사이에 사용자 조회와 토큰 서명 await 가 끼어 있고, 캐시 기반 store 는 두 동작을 원자적으로 묶지 않았기 때문이다. 2026-09-16 에 이 파일을 먼저 작성해 단계 6~8 이 실패하는 것(2건 중 2건, 5건 중 5건 성공)을 확인한 뒤, 커밋 `977efc2` 에서 다음과 같이 수정했다.
  - `IRefreshTokenStore` 에 선택 메서드 `markUsedIfUnused(jti, meta)` 를 추가했다. 이번 호출이 기록했으면 `true`, 이미 사용된 jti 면 `false` 를 반환하는 compare-and-set 이다.
  - `TokenRefreshService.refresh()` 는 사용자 조회 전의 `isUsed` 사전 확인을 유지하고, 회전 시점에 `markUsedIfUnused` 로 소비를 확정한다. 결과가 `false` 면 재사용으로 판정해 family 를 무효화하고 `TOKEN_REUSE_DETECTED` 로 거부한다.
  - `createCacheRefreshTokenStore()` 는 `TokenStoreCache` 의 선택 메서드 `setIfNotExists` 가 있으면 그 원자 연산을 쓰고, 없으면 store 인스턴스 안에서 jti 별 `exists` → `set` 을 직렬화한다.
- **결정:** 동시 갱신의 패자는 순차 재사용과 같게 취급해 family 를 무효화한다. 따라서 같은 refresh 토큰을 여러 탭에서 동시에 갱신하면 사용자가 로그아웃된다. `markUsedIfUnused` 가 없는 저장소는 기존 `isUsed` → `markUsed` 흐름을 그대로 유지한다 (하위 호환).
- **남은 한계:** `setIfNotExists` 가 없는 캐시를 여러 서버 인스턴스가 공유하면 인스턴스 사이의 동시 회전은 막지 못한다. 직렬화가 프로세스 안에서만 동작하기 때문이다. toolkit 의 `RedisCacheManager`·`HybridCacheManager` 에는 아직 `setIfNotExists` 가 없으므로, 여러 인스턴스 배포에서는 auth README 3절의 예시처럼 원자 연산을 제공하는 cache 를 주입해야 한다. `markUsedIfUnused` 를 구현하지 않은 사용자 정의 저장소도 동시 회전을 막지 못한다.

---

## 3. API Tests (요청/응답 계약 테스트)

**목적:** 이 패키지는 HTTP 서버를 소유하지 않으므로, API 도메인은 `src/next/` 가 소비자에게 제공하는 라우트 핸들러·미들웨어·프록시·oapi 가 반환하는 요청/응답 계약을 소유한다. 상태 코드, 응답 body 형태, 응답 헤더, 쿠키 부착을 검증한다.

```
소비자 라우트 (Next.js)
  → withPublicApi / withAuthApi / withAdminApi / withOptionalAuthApi   (next/middleware/wrappers)
      errorHandler → security → cors → initRequest → auth → rateLimit → responseLogger
  → createLoginHandler 등 인증 핸들러                                (next/auth-handlers)
  → createApiKeyAuth                                                  (next/oapi)
  → createAuthProxy                                                   (next/proxy, Edge)
```

**실행 명령:** 도메인 전용 스크립트는 없다. 아래 명령으로 20개 파일·264건을 실행한다 (실측 확인).

```bash
npx vitest run -c __tests__/vitest.config.ts __tests__/unit/oapi __tests__/unit/auth/handlers __tests__/unit/auth/types __tests__/unit/middleware __tests__/unit/proxy.test.ts
```

---

### TC-A-001: oapi API 키 인증 wire 계약

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-001 |
| **파일** | `__tests__/unit/oapi/api-key-auth.test.ts` |
| **대상** | `src/next/oapi/api-key-auth.ts`: `createApiKeyAuth()` |
| **우선순위** | Critical |
| **전제조건** | ApiKeyService·usage tracker 페이크 주입 |
| **테스트 데이터** | 헤더 `x-api-key: sk_live_x`, 응답 코드 40101·40301·50001 (소스 주석상 소비처 wire 계약) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `x-api-key` 헤더 없이 호출 | body `{ success: false, error: { code: 40101, message: 'X-API-Key header is required' } }` |
| 2 | usage 가 `DAILY_LIMIT`, `MONTHLY_LIMIT` 로 거부 | `code: 40301`, 메시지에 각각 `API daily usage limit exceeded`, `API monthly usage limit exceeded` |
| 3 | `validateApiKey` 가 throw | body `{ success: false, error: { code: 50001, message: 'Internal authentication error' } }` |
| 4 | `usage.canMakeApiCall` 이 throw | 인증 성공 (`user.id: 'u1'`, 가용성 우선) |
| 5 | `valid: true` 이지만 `user` 누락 | 응답 `status: 401`, `code: 40101` (방어 분기) |

- **자동화:** 가능 ✅ | **테스트 수:** 15개 (현재)
- **관련 문서:** [api-gap-scenarios.md](../../__tests__/docs/scenarios/api-gap-scenarios.md), [api-gap-testcases.md](../../__tests__/docs/testcases/api-gap-testcases.md). 코드의 `TC-API-OAPI-008~010` 은 케이스 문서에 없다 (「3세대 문서 연계와 ID 대응표」 절 참조).

---

### TC-A-002: oapi 헬퍼와 OpenAPI 스펙 생성

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-002 |
| **파일** | `__tests__/unit/oapi/helpers.test.ts`, `__tests__/unit/oapi/openapi-spec.test.ts` |
| **대상** | `src/next/oapi/helpers.ts`: `parsePaginationParams()`, `createPaginationMeta()`, `parseSearchParams()`, `requireParam()` / `src/next/oapi/openapi-spec.ts`: `buildOpenApiSpec()` |
| **우선순위** | Medium |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `parsePaginationParams(new URLSearchParams('page=3&pageSize=200'))` | `{ page: 3, pageSize: 100 }` (상한 clamp) |
| 2 | `parsePaginationParams(new URLSearchParams('page=0&pageSize=0'))` | `{ page: 1, pageSize: 10 }` |
| 3 | `requireParam('', 'id')`, `requireParam('x', 'id')` | 400 응답, `null` |
| 4 | `buildOpenApiSpec({ info, paths: {} })` | `components.securitySchemes.ApiKeyAuth` 가 `{ type: 'apiKey', in: 'header', name: 'X-API-Key' }`, `openapi` 가 `3.` 으로 시작 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (helpers 4, openapi-spec 2)
- **비고:** `openapi-spec.test.ts` 의 `전달한 paths 보존` 은 `toBeDefined()` 만 단언한다.

---

### TC-A-003: 인증 라우트 핸들러 응답 계약

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-003 |
| **파일** | `__tests__/unit/auth/handlers/handlers.test.ts`, `__tests__/unit/auth/types/handler-types.test.ts` |
| **대상** | `src/next/auth-handlers/`: `createLoginHandler()`, `createRegisterHandler()`, `createLogoutHandler()`, `createMeHandler()`, `createRefreshHandler()`, `createForgotPasswordHandler()`, `createResetPasswordHandler()`, `createVerifyEmailHandler()`, `createOAuthAuthorizeHandler()`, `createOAuthCallbackHandler()` / `src/next/auth-types/handler-types.ts`: `AuthHandlerOptions` |
| **우선순위** | Critical |
| **전제조건** | 인증 서비스·쿠키 함수·bcrypt `compare` mock, `createMockOptions()` 로 의존성 구성 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 존재하지 않는 이메일로 로그인 요청 | `status: 401`, 더미 `compare` 1회 (타이밍 균일화) |
| 2 | `emailVerificationRequired: true` 에서 미인증 사용자 로그인 | `status: 403`, body `error: 'Email not verified'`, `code: 'EMAIL_NOT_VERIFIED'` |
| 3 | 73바이트 비밀번호로 가입 요청 | `status: 400`, RegisterService 미호출 |
| 4 | 비밀번호 찾기에서 서비스가 `User not found` 로 reject | `status: 200`, `success: true` (계정 enumeration 방지) |
| 5 | refresh 서비스가 회전된 토큰 `new-rt` 반환 | `status: 200`, body `refreshToken: 'new-rt'`, 쿠키 부착 인자도 `new-rt` |
| 6 | refreshTokenStore 가 있는 로그아웃에서 `revokeByToken` 이 `AuthError` 로 reject | `status: 200`, `success: true`, 쿠키 삭제 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 83개 (handlers 80, handler-types 3)
- **비고:** `handler-types.test.ts` 는 타입 선언이 컴파일되는지 확인하는 성격이며 런타임 단언은 옵션 값 확인 수준이다.

---

### TC-A-004: tokenDelivery 모드별 핸들러 입출력

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-004 |
| **파일** | `__tests__/unit/auth/handlers/token-delivery.test.ts` |
| **대상** | `src/next/auth-handlers/login.handler.ts`, `refresh.handler.ts`, `me.handler.ts` + `src/core/auth/token-delivery.ts`: `getTokenDeliveryStrategy()` |
| **우선순위** | High |
| **전제조건** | 인증 서비스·쿠키 함수 mock |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `tokenDelivery: 'cookie'` 로 로그인 | body 에 `tokens` 없음, `setTokenCookies` 1회 |
| 2 | `tokenDelivery: 'hybrid'` 에서 쿠키 없이 body `{ refreshToken: 'rt-456' }` 로 refresh | `success: true`, body `accessToken: 'new-at'` (body 폴백) |
| 3 | `header` 모드 refresh 에 `refresh_token` 쿠키만 있음 | 쿠키를 무시하므로 `status: 401` |
| 4 | 어디에도 refresh 토큰이 없음 | `status: 401` |

- **자동화:** 가능 ✅ | **테스트 수:** 14개 (현재)

---

### TC-A-005: 인증 미들웨어 토큰 추출·검증

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-005 |
| **파일** | `__tests__/unit/middleware/auth-middleware.test.ts`, `__tests__/unit/middleware/auth-cookie-extraction.test.ts`, `__tests__/unit/middleware/auth-token-delivery-mode.test.ts`, `__tests__/unit/middleware/optional-auth-middleware.test.ts` |
| **대상** | `src/next/middleware/auth.ts`: `authMiddleware`, `optionalAuthMiddleware`, `setAccessTokenBlacklistChecker()`, `initializeAuthMiddleware()` |
| **우선순위** | Critical |
| **전제조건** | `initializeAuth()` 로 시크릿 설정, 실제 JWT 서명 토큰 사용 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 쿠키에 유효 토큰, Authorization 헤더에 `Bearer invalid-token` | 쿠키 토큰으로 `context.user` 설정 |
| 2 | 모든 토큰을 revoke 로 판정하는 blacklist checker 설정 후 요청 | `AppError`, `INVALID_TOKEN` 코드, 메시지에 `revoked` |
| 3 | 만료된 access 토큰 | `AppError`, `TOKEN_EXPIRED` 코드 |
| 4 | `cookie` 모드에서 Authorization 헤더만 있음 | reject (헤더 무시) |
| 5 | `optionalAuthMiddleware` 에 만료 토큰 | 오류 없이 `next()` 호출, `context.user` 미설정 |

- **자동화:** 가능 ✅ | **테스트 수:** 39개 (auth-middleware 17, auth-cookie-extraction 7, auth-token-delivery-mode 7, optional-auth-middleware 8)

---

### TC-A-006: 역할 기반 접근 제어

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-006 |
| **파일** | `__tests__/unit/middleware/role-middleware.test.ts`, `__tests__/unit/middleware/require-admin.test.ts` |
| **대상** | `src/next/middleware/auth.ts`: `createRoleMiddleware()`, `adminMiddleware` / `src/next/utils/api-helpers.ts`: `requireAdmin()` |
| **우선순위** | High |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `createRoleMiddleware('ADMIN', 'EDITOR')` 에 role `USER` | `AppError`, `FORBIDDEN` 코드 |
| 2 | `createRoleMiddleware('ADMIN')` 에서 거부되는 사용자 | `next()` 미호출 |
| 3 | `context.user` 가 `undefined`·`null` | `UNAUTHORIZED` 코드 |
| 4 | `requireAdmin('ADMIN', 'SUPERADMIN')` | `isAdmin: false`, 응답 `status: 403` |

- **자동화:** 가능 ✅ | **테스트 수:** 16개 (role-middleware 12, require-admin 4)

---

### TC-A-007: API 래퍼 구성과 미들웨어 체인 실행

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-007 |
| **파일** | `__tests__/unit/middleware/middleware.test.ts`, `__tests__/unit/middleware/wrappers.test.ts`, `__tests__/unit/middleware/middleware-chain.test.ts` |
| **대상** | `src/next/middleware/wrappers.ts`: `withPublicApi()`, `withAuthApi()`, `withAdminApi()`, `withOptionalAuthApi()`, `withCustomApi()` / `src/next/middleware/middleware-chain.ts`: `MiddlewareChain` |
| **우선순위** | High |
| **전제조건** | 래퍼 테스트는 구성 미들웨어(errorHandler, security, cors, initRequest, auth, rateLimit, responseLogger)를 호출 순서만 기록하는 mock 으로 대체 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `withAuthApi(handler)` 실행 | 호출 순서 `errorHandler → security → cors → initRequest → auth → rateLimit:api → responseLogger` |
| 2 | `withAdminApi(handler)` 에 role `USER` 사용자 | `Forbidden` reject, handler 미호출 |
| 3 | `withOptionalAuthApi(handler)` 실행 | `optionalAuth` 포함, `auth`·`admin` 미포함 |
| 4 | 첫 미들웨어가 403 응답을 반환 (next 미호출) | 체인 결과가 그 응답과 동일 |
| 5 | `continueOnError: true` 에서 첫 미들웨어 throw | 다음 미들웨어·핸들러 계속 실행 |
| 6 | `timeout: 50` 에서 200ms 지연 미들웨어 | `Timeout after 50ms` reject |

- **자동화:** 가능 ✅ | **테스트 수:** 30개 (middleware 11, wrappers 8, middleware-chain 11)
- **비고:** 래퍼 테스트는 구성 미들웨어를 모두 mock 하므로, `init-request.ts`·`error-handler.ts`·`response-logger.ts` 자체는 실행되지 않는다 (커버리지 0%). TC-A-011 에서 다룬다.

---

### TC-A-008: 요청 보안 미들웨어 (Content-Type·Origin)

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-008 |
| **파일** | `__tests__/unit/middleware/security-middleware.test.ts`, `__tests__/unit/middleware/origin-verification.test.ts` |
| **대상** | `src/next/middleware/security.ts`: `securityMiddleware`, `setAllowedOrigins()`, `validateSecurityConfiguration()` |
| **우선순위** | High |
| **전제조건** | logger mock |
| **테스트 데이터** | 허용 Origin `https://example.com`, 공격 Origin `https://evil.com` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | POST, `content-length: 42`, Content-Type 없음 | `status: 415`, `error.code: 41500`, 메시지에 `Content-Type header is required`, next 미호출 |
| 2 | POST, `content-type: text/xml` | `status: 415`, `Accept` 헤더에 `application/json`·`multipart/form-data` |
| 3 | 허용 목록 설정 후 Origin `https://evil.com` 으로 POST | `status: 403`, `error.code: 40300` |
| 4 | 허용 목록 설정 후 Origin·Referer 모두 없는 POST | `status: 403` |

- **자동화:** 가능 ✅ | **테스트 수:** 28개 (security-middleware 19, origin-verification 9)

---

### TC-A-009: Rate limit 미들웨어

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-009 |
| **파일** | `__tests__/unit/middleware/rate-limit-is-enabled.test.ts`, `__tests__/unit/middleware/rate-limit-adapter.test.ts` |
| **대상** | `src/next/middleware/rate-limit.ts`: `createRateLimitMiddleware()`, `setRateLimitAdapter()` |
| **우선순위** | High |
| **전제조건** | `IRateLimitAdapter` 페이크 (limiter `check` mock) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | limiter 가 `{ success: false, remaining: 0 }` 반환 | reject, next 미호출 |
| 2 | 비인증 요청, `extractClientIp` → `10.0.0.1` | `limiter.check('ip:10.0.0.1')` |
| 3 | `isEnabled(type)` 가 `auth` 에만 `false` | api 미들웨어는 check 수행, auth 미들웨어는 check 없이 next |
| 4 | 어댑터 미설정 상태로 두 번 요청 | 경고 로그는 첫 요청에서만 1회 |

- **자동화:** 가능 ✅ | **테스트 수:** 20개 (rate-limit-is-enabled 13, rate-limit-adapter 7)

---

### TC-A-010: Edge 인증 프록시

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-010 |
| **파일** | `__tests__/unit/proxy.test.ts` |
| **대상** | `src/next/proxy.ts`: `createAuthProxy()`, `verifyAccessTokenEdge()` |
| **우선순위** | High |
| **전제조건** | `isProtected` 판정 함수 주입, jose `SignJWT` 로 HS256 서명한 토큰 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 보호 대상이 아닌 `/public` 요청 | `undefined` (다른 프록시와 합성 가능) |
| 2 | 토큰 없는 `/dashboard` 요청 | 로그인으로 리다이렉트, `access_token` 쿠키 값 `''` |
| 3 | `redirectParam: 'redirect'` 로 `/dashboard?tab=1` 요청 | Location 의 `redirect` 쿼리가 `/dashboard?tab=1` |
| 4 | 만료·서명 불일치·형식 오류 토큰으로 `verifyAccessTokenEdge()` | 모두 `null` |

- **자동화:** 가능 ✅ | **테스트 수:** 13개 (현재)

---

### TC-A-011: 요청 초기화·오류 응답·응답 기록 미들웨어 🔲 계획

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-A-011 |
| **파일** | `__tests__/unit/middleware/pipeline-middlewares.test.ts` (신규) |
| **대상** | `src/next/middleware/init-request.ts`: `initRequestMiddleware` / `error-handler.ts`: `errorHandlerMiddleware` / `response-logger.ts`: `responseLoggerMiddleware` (세 파일 모두 커버리지 0%) |
| **우선순위** | High |
| **전제조건** | logger (`logger`, `logApiRequest`, `logApiResponse`) mock, 실제 `NextResponse` 사용 |
| **테스트 데이터** | accept-language `en-US`, `metadata.rateLimit = { limit: 100, remaining: 99, reset: 1700000000 }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | requestId·locale·startTime·metadata 가 없는 context 로 `initRequestMiddleware` | requestId UUID 생성, locale `'en'`, `metadata: {}`, next 1회 |
| 2 | requestId `'req-1'` 이 이미 있는 context | `'req-1'` 유지 |
| 3 | next 가 `AppError(40401)` throw 할 때 `errorHandlerMiddleware` | `status: 404` (`Math.floor(40401 / 100)`), body `error.code: 40401`, `error.requestId`, `error.userMessage.title` 존재 |
| 4 | next 가 `ZodError` throw | `status: 400`, `code: 40001`, `error.metadata.issues[0].path` 존재 |
| 5 | next 가 `JWTError(..., 'TOKEN_EXPIRED')` throw | `status: 401`, `code: 40103` (`AUTH_ERROR_CODE_MAP`) |
| 6 | next 가 `new Error('boom')` throw | `status: 500`, `code: 50002` (`SERVER_ERROR`), body 에 stack 없음, `logger.error('[ErrorHandler] Unexpected error:', ...)` |
| 7 | `metadata.rateLimit` 이 있는 context 로 `responseLoggerMiddleware` | 응답 헤더 `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining: 99`, `X-Request-ID` = requestId. next 가 throw 하면 `logger.error('API Error', ...)` 후 같은 오류 재throw |

- **자동화:** 가능 ✅

---

## 4. E2E Tests (소비자 여정 테스트)

**목적:** UI 가 없는 라이브러리이므로 E2E 는 소비자가 실제로 사용하는 경로, 곧 빌드 산출물 `dist/` 를 subpath 로 import 해 전체 흐름을 실행하는 여정으로 정의한다. `src` 대상 테스트로는 tsup 변환 오류, ESM 문법 오류, chunk 참조 파손, 경로 alias 잔재를 발견할 수 없기 때문이다.

**실행 명령:** 도메인 전용 스크립트는 없다.

```bash
npm run build && npx vitest run -c __tests__/vitest.config.ts __tests__/build/consumer-runtime.test.ts
```

---

### TC-E-001: dist api-key 소비자 여정

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-E-001 |
| **파일** | `__tests__/build/consumer-runtime.test.ts` |
| **대상** | `dist/core/api-key/errors.js`, `dist/core/api-key/api-key.service.js` |
| **우선순위** | Critical |
| **전제조건** | `npm run build` 선행. `dist/core/api-key/errors.js` 가 없으면 `beforeAll` 이 `먼저 npm run build 실행 필요` 오류로 실패 |
| **테스트 데이터** | 소비자 관점 Map 기반 repo 페이크, 플랜 `PRO`, 제한 플랜 `FREEMIUM` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | dist `errors.js` 를 동적 import 해 `new ApiKeyError('API key not found', NOT_FOUND)` | `Error` 인스턴스, `isApiKeyError(err, NOT_FOUND)` 가 `true`, 일반 `Error` 는 `false` |
| 2 | dist `ApiKeyService` 로 production 키 발급 | 키가 `sk_live_` 로 시작, `validateApiKey()` 가 `valid: true` |
| 3 | `regenerateApiKey()` 로 회전 | 새 키 `valid: true` |
| 4 | 회전 전 구키로 `validateApiKey()`, 없는 키로 `getApiKey('missing', 'u1')` | 구키 `valid: false`, 오류가 dist `isApiKeyError(err, NOT_FOUND)` 로 판별됨 |

- **자동화:** 가능 ✅ | **테스트 수:** 2개 (현재)
- **관련 문서:** [e2e-gap-scenarios.md](../../__tests__/docs/scenarios/e2e-gap-scenarios.md), [e2e-gap-testcases.md](../../__tests__/docs/testcases/e2e-gap-testcases.md)

---

### TC-E-002: dist Prisma 오류 분류 소비자 여정

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-E-002 |
| **파일** | `__tests__/build/consumer-runtime.test.ts` (`TC-E-002: dist Prisma 오류 분류 소비자 여정` describe 블록) |
| **대상** | `dist/core/error/prisma-error.js`, `dist/core/constants/error-codes.js`, `dist/next/utils/error-processor.js`, `dist/next/error/error-handler.js` |
| **우선순위** | High |
| **전제조건** | `npm run build` 선행, `next` 는 devDependency 로 설치되어 있어 dist 의 `next/server` import 가 Vitest 에서 해석됨 |
| **테스트 데이터** | `name: 'PrismaClientKnownRequestError'` 와 `code` 를 부여한 `Error` (P2002 는 메시지 `'x'.repeat(4000)`, P2025 는 메시지 `'Operation failed'`, P2011, P2003), `name: 'PrismaClientValidationError'` 인 `Error` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | dist `prisma-error.js` 의 `inspectPrismaError()` 로 P2002 오류 판정 | `code: 'P2002'`, `source: 'property'` |
| 2 | dist `prisma-error.js` 의 `PRISMA_ERROR_MAP.P2011`, `PRISMA_MESSAGE_SCAN_LIMIT` | `status: 400`, `200` |
| 3 | dist `error-codes.js` 의 `classifyError()` 에 검증 오류 전달 | `status: 400` (401 아님) |
| 4 | dist `error-processor.js` 의 `ErrorProcessor.process()` 에 P2025 오류 전달 | `status: 404`, `details: { prismaCode: 'P2025' }` |
| 5 | dist `error-handler.js` 의 `processError()` 에 P2002 오류 전달 | `status: 409`, `code: 40905` |
| 6 | dist `error-processor.js` 의 `handlePrismaError()` 에 P2011·P2003 오류 전달 | 둘 다 `status: 400`, 본문 `{ success: false, error: { code, message } }` 가 dist `PRISMA_ERROR_MAP` 과 같음 |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (파일 전체 7개 중 TC-E-001 의 2개 제외)
- **결함 이력:** 계획 당시에는 0.15.0 게시 전후로 호스트가 받는 응답 코드(P2011 500 → 400)가 달라지므로 dist 수준 회귀를 먼저 고정해 둔다는 선행 조건을 적었다. 2026-09-16 에 계획 단계 1~5 에 `handlePrismaError()` 단계 6 을 더해 작성했고, 수정 전 소스로 빌드한 dist 에서 단계 6 이 `P2011 상태 코드: expected 500 to be 400` 으로 실패하는 것을 확인했다. 커밋 `c07a669` (TC-U-027) 수정 뒤 다시 빌드해 통과를 확인했다.

---

## 5. Security Tests (보안 테스트)

**목적:** 비밀 재료 취급, 인증 우회(토큰 위조·알고리즘 혼동·CSRF), 비밀번호 저장, CORS 반사, 오류 응답 정보 노출, XSS 를 검증한다. OWASP Top 10 기준으로 분류한다.

**실행 명령:** `npm run test:security`

---

### TC-S-001: api-key 비밀 재료 취급

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-001 |
| **파일** | `__tests__/security/api-key/api-key-secrets.test.ts` |
| **대상** | `src/core/api-key/api-key.service.ts`: `generateApiKey()`, `getApiKey()`, `validateApiKey()` / `key-generator.ts`: `generateRawKey()`, `hashKey()` |
| **우선순위** | Critical |
| **전제조건** | repo `create` 인자를 캡처하는 페이크 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `generateApiKey()` 후 `repo.create` 인자 확인 | `key === hashKey(원문)`, 64자 hex, 인자 JSON 어디에도 원문 없음 |
| 2 | 미존재 키와 만료 키로 `validateApiKey()` 후 `message` 확인 | 두 경우 모두 `valid: false`, 메시지에 원문·해시 미포함 |
| 3 | 저장 해시로 `getApiKey()` 후 `keyPreview` 확인 | `해시 앞 10자...해시 뒤 4자`, 원문 꼬리 8자 미포함 |
| 4 | `generateRawKey('sk_live_')` 1,000회 | 모두 `/^sk_live_[0-9a-f]{64}$/`, 중복 0 |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)
- **관련 요구사항:** OWASP A02:2021 Cryptographic Failures
- **관련 문서:** [security-gap-scenarios.md](../../__tests__/docs/scenarios/security-gap-scenarios.md), [security-gap-testcases.md](../../__tests__/docs/testcases/security-gap-testcases.md)

---

### TC-S-002: JWT 서명·알고리즘 혼동·토큰 종류 혼동 방어

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-002 |
| **파일** | `__tests__/security/auth/auth-jwt.test.ts`, `__tests__/security/auth/jwt-asymmetric.test.ts`, `__tests__/security/auth/jwt-token-confusion.test.ts` |
| **대상** | `src/core/auth/jwt/index.ts`: `JWTService.createAccessToken()`, `verifyAccessToken()`, `createTokenPair()` (HS256·RS256·ES256·EdDSA) |
| **우선순위** | Critical |
| **전제조건** | 비대칭 케이스는 테스트 안에서 RSA·EC·Ed25519 키 쌍 생성, 혼동 케이스는 jose `SignJWT` 로 직접 위조 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 다른 시크릿으로 서명한 토큰을 `verifyAccessToken()` | `JWTError` reject |
| 2 | 시크릿 `'short'` 로 `new JWTService()` | `JWTError`, code `TOKEN_CREATION_FAILED`, `statusCode: 401` |
| 3 | RS256 발급 토큰을 ES256 공개키 검증기로 검증 | code `TOKEN_VERIFICATION_FAILED` (알고리즘 혼동 차단) |
| 4 | 비대칭 알고리즘에 키 재료 없이 생성 | throw |
| 5 | 같은 시크릿으로 access 클레임 + `tokenType: 'refresh'` 토큰 위조 후 `verifyAccessToken()` | `JWTError` reject |
| 6 | `tokenType` 이 없는 레거시 access 토큰 검증 | 통과, `userId: 'u1'` (하위 호환) |

- **자동화:** 가능 ✅ | **테스트 수:** 28개 (auth-jwt 10, jwt-asymmetric 15, jwt-token-confusion 3)
- **관련 요구사항:** OWASP A07:2021 Identification and Authentication Failures

---

### TC-S-003: OAuth CSRF state 검증과 인가 URL 파라미터

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-003 |
| **파일** | `__tests__/security/auth/oauth-state-csrf.test.ts`, `__tests__/security/auth/oauth-prompt-parameter.test.ts`, `__tests__/security/auth/oauth.test.ts` |
| **대상** | `src/next/auth-handlers/oauth-authorize.handler.ts`, `oauth-callback.handler.ts` / `src/core/auth/oauth/index.ts`: `OAuthManager.getLoginUrl()`, `exchangeCodeForToken()`, `getUserInfo()` |
| **우선순위** | Critical |
| **전제조건** | 토큰 교환 함수 mock, `global.fetch` mock |
| **테스트 데이터** | query state `S1`, 쿠키 state `S2` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `oauth_state` 쿠키 없이 `?code=abc&state=S1` 콜백 | `status: 400`, `error: 'Invalid OAuth state'`, 토큰 교환 미호출 |
| 2 | 쿠키 `S2`, query `S1` 콜백 | `status: 400`, 토큰 교환 미호출 |
| 3 | Google 인가 URL 생성 | `prompt=select_account consent` 포함 |
| 4 | GitHub 인가 URL 생성 | `prompt` 파라미터 없음 |
| 5 | `getLoginUrl(GOOGLE, 'csrf-protection-token')` | URL 에 `state=csrf-protection-token` 포함 |

- **자동화:** 가능 ✅ | **테스트 수:** 55개 (oauth-state-csrf 4, oauth-prompt-parameter 10, oauth 41)
- **관련 요구사항:** OWASP A01:2021 Broken Access Control (CSRF)
- **비고:** `oauth-prompt-parameter.test.ts` 의 테스트 이름은 `TC-E2E-OAUTH-SEL-*` 이지만 실제 내용은 URL 생성 단위 검증이며 dist 를 실행하지 않는다. 이 문서는 E2E 가 아닌 Security 로 분류한다.

---

### TC-S-004: 비밀번호 해싱과 해시 마이그레이션

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-004 |
| **파일** | `__tests__/security/auth/password-hasher.test.ts`, `__tests__/security/auth/password.test.ts` |
| **대상** | `src/core/auth/password/hasher.ts`: `BcryptPasswordHasher`, `Argon2idPasswordHasher`, `MigratingPasswordHasher` / `src/core/auth/password/index.ts`: `PasswordValidator`, `PasswordHasher`, `defaultPasswordSchema`, `strongPasswordSchema` |
| **우선순위** | Critical |
| **전제조건** | argon2 부재 케이스는 `vi.doMock('argon2', ...)` 로 설치 여부와 무관하게 재현 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | rounds 4 로 만든 해시를 rounds 10 해셔의 `needsRehash()` | `true` |
| 2 | argon2 모듈이 없는 상태에서 `hash()`·`verify()` | code `ARGON2_NOT_INSTALLED`, `AuthError` reject |
| 3 | 레거시 스킴 해시 `legacy$secret` 을 `MigratingPasswordHasher.verify()` | 올바른 비밀번호 `true`, 틀린 비밀번호 `false` |
| 4 | 복잡도 규칙을 만족하는 74바이트 비밀번호 검증 | `isValid: false`, 오류에 `72` 포함 (bcrypt 절단 방지) |
| 5 | 맞는 비밀번호와 틀린 비밀번호 `verify()` 소요 시간 비교 | 차이 50ms 미만 |

- **자동화:** 가능 ✅ | **테스트 수:** 67개 (password-hasher 17, password 50)
- **관련 요구사항:** OWASP A02:2021 Cryptographic Failures

---

### TC-S-005: 비밀번호 정책 클래스와 검증 상수

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-005 |
| **파일** | `__tests__/security/validators/validators.test.ts`, `__tests__/security/validators/validation-constants.test.ts` |
| **대상** | `src/core/validators/password-validator.ts`: `PasswordValidator`, `defaultPasswordSchema`, `strongPasswordSchema` / `src/core/constants/validation.ts`: `PASSWORD`, `USER_INPUT`, `URL`, `TEXT`, `NUMERIC`, `DATE`, `FILE_UPLOAD` |
| **우선순위** | High |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `PasswordValidator.validate('가'.repeat(25), { requireNumber: false, minLength: 1 })` | `isValid: false` (75바이트, 문자 수가 아닌 바이트로 계산) |
| 2 | `defaultPasswordSchema.parse('P1' + 'a'.repeat(127))` | throw (최대 128자) |
| 3 | `FILE_UPLOAD.ALLOWED_IMAGE_EXTENSIONS` 확인 | `jpg`, `jpeg`, `png`, `gif`, `webp` 포함 |

- **자동화:** 가능 ✅ | **테스트 수:** 68개 (validators 51, validation-constants 17)
- **비고:** `PasswordValidator` 는 `src/core/auth/password/index.ts` 와 `src/core/validators/password-validator.ts` 두 곳에 별도 클래스로 존재하며, TC-S-004 와 TC-S-005 가 각각을 검증한다. `validation-constants.test.ts` 의 `* constants exist` 7건은 `toBeDefined()` 만 단언한다.

---

### TC-S-006: CORS 자격 증명 반사 방지

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-006 |
| **파일** | `__tests__/security/cors-credential-reflection.test.ts` |
| **대상** | `src/next/utils/cors.ts`: `setCorsHeaders()`, `isOriginAllowed()`, `initCorsConfig()` / `src/next/middleware/cors.ts`: `createCorsMiddleware()` |
| **우선순위** | Critical |
| **전제조건** | `initCorsConfig({ isDevelopment: true, additionalOrigins: ['https://app.example.com'] })` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | Origin 헤더 없는 요청에 `setCorsHeaders()` | `Access-Control-Allow-Origin: *` 와 `Allow-Credentials: true` 가 함께 설정되지 않음 |
| 2 | 개발 환경에서 `isOriginAllowed('https://localhost.attacker.com')` | `false` (부분 문자열 localhost 우회 차단) |
| 3 | 허용 Origin 을 반사하는 `createCorsMiddleware()` 응답 | `Vary` 헤더에 `origin` 포함 (캐시 오염 방지) |

- **자동화:** 가능 ✅ | **테스트 수:** 8개 (현재)
- **관련 요구사항:** OWASP A05:2021 Security Misconfiguration
- **비고:** `src/next/utils/cors.ts` 는 이 파일만 실행하며 커버리지 43.67% 이다.

---

### TC-S-007: 오류 응답 내부 정보 노출 방지

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-007 |
| **파일** | `__tests__/security/error/error-info-exposure.test.ts` |
| **대상** | `src/next/error/error-handler.ts`: `errorToResponse()`, `processError()` |
| **우선순위** | High |
| **전제조건** | logger·`next/server` mock |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 파일 경로가 담긴 stack 을 가진 Error 를 `errorToResponse()` | body JSON 에 `.ts:`, `at `, `node:internal` 없음, `error.stack` 미정의 |
| 2 | `Unique constraint failed on the constraint: \`User_email_key\` P2002` 를 `processError()` | 반환 메시지에 `User_email_key` 없음 |
| 3 | 메시지에 `P2025` 가 있는 Prisma 오류 | `status: 404` |

- **자동화:** 가능 ✅ | **테스트 수:** 12개 (현재)
- **관련 요구사항:** OWASP A04:2021 Insecure Design (정보 노출)
- **비고:** `should return the same error code for "user not found" and "wrong password"` 는 똑같이 생성한 `AuthError` 두 개를 비교하므로 항상 참이다. 실제 로그인 경로에서 두 상황이 같은 응답을 내는지는 TC-A-003 단계 1 이 검증한다.

---

### TC-S-008: XSS 새니타이저

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-S-008 |
| **파일** | `__tests__/security/utils/sanitizer.test.ts` |
| **대상** | `src/core/utils/sanitizer.ts`: `sanitizeHtml()`, `removeEventHandlers()`, `sanitizeUrl()`, `sanitizeInput()`, `sanitizeArray()`, `sanitizeObjectFields()` |
| **우선순위** | High |
| **전제조건** | 없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `removeEventHandlers('<img src=x onerror=alert(1)>')` | `onerror` 미포함 |
| 2 | `removeEventHandlers('onclick=doEvil()')` | `''` |
| 3 | `sanitizeUrl('data:image/png;base64,abc123')` | `''` 이 아님 (이미지 data URL 허용) |
| 4 | `sanitizeHtml('&#60;script&#62;alert(1)&#60;/script&#62;')` | `'alert(1)'` |

- **자동화:** 가능 ✅ | **테스트 수:** 41개 (현재)
- **관련 요구사항:** OWASP A03:2021 Injection
- **비고:** `should handle formula injection attempts` 는 `=1+1` 등 CSV 수식 입력에 대해 `toBeDefined()` 만 단언하므로 CSV Injection 방어를 검증하지 않는다. 40건은 `unit/utils/sanitizer.test.ts` 와 중복이다.

---

## 6. Performance Tests (성능 테스트)

**목적:** 요청마다 실행되는 경로의 처리 시간이 차수 단위로 느려지는 회귀를 감지한다. 임계값은 CI 편차를 감안해 넉넉하게 두고 환경변수로 조정한다.

**실행 명령:** `npm run test:performance` (8절 Load/Stress 파일 1개를 함께 실행한다)

---

### TC-P-001: api-key 인증 hot path 처리 시간 상한

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-P-001 |
| **파일** | `__tests__/performance/api-key/api-key-hotpath.test.ts` |
| **대상** | `src/core/api-key/key-generator.ts`: `hashKey()` / `api-key.service.ts`: `validateApiKey()` 캐시 적중 경로 |
| **우선순위** | High |
| **전제조건** | `performance.now()` 측정 |
| **테스트 데이터** | `TEST_APIKEY_PERF_HASH_MS` 기본 2000, `TEST_APIKEY_PERF_CACHE_MS` 기본 2000 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `hashKey()` 10,000회 | 2,000ms 미만 |
| 2 | 캐시 적중 상태에서 `validateApiKey()` 1,000회 | 2,000ms 미만, `repo.findByHash` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 2개 (현재)
- **관련 문서:** [performance-gap-scenarios.md](../../__tests__/docs/scenarios/performance-gap-scenarios.md), [performance-gap-testcases.md](../../__tests__/docs/testcases/performance-gap-testcases.md)

---

### TC-P-002: 캐시 매니저 대용량 eviction·기능 회귀

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-P-002 |
| **파일** | `__tests__/performance/cache/cache-limit-lru.test.ts`, `__tests__/performance/cache/cache-managers.test.ts`, `__tests__/performance/cache/cache-advanced.test.ts`, `__tests__/performance/cache/redis-delete-pattern-scan.test.ts` |
| **대상** | `src/core/cache/inmemory-cache-manager.ts`, `noop-cache-manager.ts`, `hybrid-cache-manager.ts`, `redis-cache-manager.ts`: `deletePattern()` 등 |
| **우선순위** | Medium |
| **전제조건** | Redis 클라이언트 mock |
| **테스트 데이터** | `TEST_INMEMORY_CACHE_MAX_SIZE` 기본 100,000, `TEST_INMEMORY_CACHE_MAX_MEMORY_MB` 기본 2,000, scan `count: 100` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `MAX_SIZE` 개 채운 뒤 1건 추가 (LRU) | `itemCount` 유지, 최초 항목 `item:0` 제거, 새 항목 존재 |
| 2 | FIFO 정책에서 `item:0` 조회 후 1건 추가 | 조회와 무관하게 `item:0` 제거 |
| 3 | maxSize 3 에서 key1 조회 후 key4 추가 | key2 만 제거 |
| 4 | Redis `deletePattern('user:*')` | `scan(0, { match: 'user:*' 포함, count: 100 })` 호출, `keys` 미사용 |
| 5 | scan 커서가 100 → 200 → 0 으로 반환 | scan 3회, 배치마다 del 3회 |
| 6 | `NoopCacheManager` get·set 각 10,000회 | 100ms 미만 |

- **자동화:** 가능 ✅ | **테스트 수:** 96개 (cache-limit-lru 11, cache-managers 49, cache-advanced 30, redis-delete-pattern-scan 6)
- **비고:** 이 4개 파일의 96건 중 처리 시간을 단언하는 테스트는 단계 6 의 1건뿐이고 나머지는 기능 검증이다. `cache-advanced.test.ts` 의 오류 처리 4건(`should handle set/delete/deletePattern/expire errors`)은 `resolves.not.toThrow()` 또는 `toBeDefined()` 수준으로만 단언한다.

---

## 7. Accessibility Tests (접근성 테스트)

**목적:** 해당 없음. 이 패키지는 렌더링되는 UI 를 제공하지 않으므로 WCAG 검증 대상(DOM, 색 대비, 포커스, ARIA)이 없다.

**실행 명령:** `npm run test:accessibility` 스크립트가 남아 있으나 `__tests__/accessibility` 디렉토리가 없어 `No test files found` 로 종료 코드 1 을 반환한다 (실측).

React UI 계층은 0.8.0 에서 `@withwiz/ui` 로 분리되었다 (`CHANGELOG.md` 의 `[0.8.0] - 2026-06-15`). 남은 유일한 React 표면인 `src/next/error/ErrorBoundary.tsx` 는 커버리지 0% 이지만, 접근성보다 오류 경계 동작 검증에 해당하므로 이 도메인의 시나리오로 두지 않는다. 3세대 판정은 [accessibility-gap-scenarios.md](../../__tests__/docs/scenarios/accessibility-gap-scenarios.md) 에 기록되어 있다.

---

## 8. Load/Stress Tests (동시 호출 일관성 테스트)

**목적:** 부하를 받을 서버가 없는 라이브러리이므로, 이 도메인은 서비스가 이벤트 루프에서 동시에 호출될 때 결과가 일관되고 unhandled rejection 이 발생하지 않는지를 소유한다. 부하 인프라가 없어 파일은 `performance/` 디렉토리에 함께 둔다.

**실행 명령:** 도메인 전용 스크립트는 없다.

```bash
npx vitest run -c __tests__/vitest.config.ts __tests__/performance/api-key/api-key-concurrency.test.ts
```

---

### TC-L-001: api-key 동시 호출 결과 일관성

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-L-001 |
| **파일** | `__tests__/performance/api-key/api-key-concurrency.test.ts` |
| **대상** | `src/core/api-key/api-key.service.ts`: `validateApiKey()`, `trackUsage()` |
| **우선순위** | High |
| **전제조건** | Map 기반 캐시 페이크 (miss 와 hit 가 섞이도록 빈 상태에서 시작) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 같은 원문 키로 `validateApiKey()` 100건을 `Promise.allSettled` 로 동시 실행 | rejected 0건, 100건 모두 `valid: true` |
| 2 | `incrementUsage` 가 짝수 번째 호출마다 throw 하는 상태에서 `trackUsage()` 100건 동시 실행 | rejected 0건 (추적 실패가 전파되지 않음) |

- **자동화:** 가능 ✅ | **테스트 수:** 2개 (현재)
- **관련 문서:** [load-stress-gap-scenarios.md](../../__tests__/docs/scenarios/load-stress-gap-scenarios.md), [load-stress-gap-testcases.md](../../__tests__/docs/testcases/load-stress-gap-testcases.md). 시나리오 문서는 `generateApiKey()` 한도 검사가 check-then-act 라서 동시 발급을 원자적으로 막지 않는다는 한계를 기록해 두었다.

---

### TC-L-002: 인메모리 캐시 카운터·용량 동시 호출 일관성 🔲 계획

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-L-002 |
| **파일** | `__tests__/performance/cache/inmemory-concurrency.test.ts` (신규) |
| **대상** | `src/core/cache/inmemory-cache-manager.ts`: `increment()`, `set()`, `getStats()` |
| **우선순위** | Medium |
| **전제조건** | `InMemoryCacheManager` 실인스턴스, 테스트 후 `destroy()` |
| **테스트 데이터** | 동시 호출 1,000건, 단계 4 는 `{ maxSize: 1000, maxMemoryMB: 100 }` 설정 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `increment('c')` 1,000건을 `Promise.all` 로 동시 실행 후 `get('c')` | `1000` |
| 2 | 단계 1 의 반환값 집합 확인 | 서로 다른 값 1,000개, 최댓값 1000 |
| 3 | `increment('c5', 5)` 100건 동시 실행 | 최종값 `500` |
| 4 | `maxSize: 1000` 인스턴스에 서로 다른 키 1,100건 `set()` 동시 실행 | `getStats().itemCount` 가 `1000` |

- **자동화:** 가능 ✅
- **근거:** `increment()` 는 조회·계산 후 `await this.set()` 을 호출하고, `set()` 내부에는 await 가 없어 Map 기록이 첫 중단 지점 이전에 끝난다. 따라서 동시 호출이어도 갱신이 유실되지 않는다. 단계 1·2 는 스크래치 실행으로 같은 결과(1000, 고유값 1000개)를 확인했다.
- **제외한 항목:** refresh 토큰 동시 회전 경쟁은 2026-09-13 판에서 두 요청이 모두 성공하는 결함성 동작이라 케이스로 두지 않았다. 2026-09-16 수정(`977efc2`) 뒤 동시 갱신 결과의 일관성은 TC-I-003 단계 6~8 이 검증한다.

---

## 9. Smoke Tests (배포 산출물 스모크 테스트)

**목적:** 배포(publish) 직전 크리티컬 경로인 `package.json` exports 와 `dist/` 산출물이 일치하는지 검증한다. exports 목록을 데이터로 삼아 테스트를 생성하므로 subpath 가 추가되면 케이스도 자동으로 늘어난다.

**실행 명령:** 도메인 전용 스크립트는 없다. `prepublishOnly` (`npm run build && npm test`)가 전체 테스트에 포함해 실행한다.

```bash
npm run build && npx vitest run -c __tests__/vitest.config.ts __tests__/build/exports-integrity.test.ts
```

---

### TC-SM-001: exports 무결성과 dist 산출물 검증

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-SM-001 |
| **파일** | `__tests__/build/exports-integrity.test.ts` |
| **대상** | `package.json` `exports` (정적 subpath 159개), `dist/` 전체 |
| **우선순위** | Critical |
| **전제조건** | `npm run build` 선행 |
| **테스트 데이터** | `KNOWN_MISSING` 빈 배열, 번들 오염 검사 대상 외부 의존성 12종 (react, next, jose, zod 등), dist 총량 상한 5MB, chunk 상한 100KB |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | exports 의 모든 정적 subpath 에 대해 JS 대상 파일 존재 확인 | 159건 모두 존재 |
| 2 | 같은 subpath 의 `.d.ts` 존재 확인 | 159건 모두 존재 |
| 3 | dist `.d.ts` 전체에서 `@withwiz/toolkit/*` import 수집 | 모두 exports 에 등록된 subpath |
| 4 | dist `.js` 총 크기, chunk 파일 개별 크기 | 5MB 미만, 100KB 를 넘는 chunk 없음 |
| 5 | package.json 메타데이터 확인 | exports 가 `src/` 를 직접 가리키지 않음, dependencies 와 devDependencies 중복 없음, 산출물이 ESM 형식 |

- **자동화:** 가능 ✅ | **테스트 수:** 330개 (현재)
- **관련 문서:** [smoke-gap-scenarios.md](../../__tests__/docs/scenarios/smoke-gap-scenarios.md) (신규 케이스 없음 판정)
- **비고:** 330건은 exports 개수에 비례한다 (정적 subpath 159 × 2 = 318, wildcard 없음 1, 전역 type 검사 3, 번들 오염 3, 메타데이터 5, 조건부 테스트 `documents known missing exports` 는 `KNOWN_MISSING` 이 비어 있어 등록되지 않음). 런타임 import 검증은 TC-E-001 이 소유한다.

---

## 10. Chaos Tests (포트 장애 주입 테스트)

**목적:** 외부 서비스는 포트(`IApiKeyCacheStore`, `IRefreshTokenStore` 등) 뒤에 있으므로, 이 도메인은 포트가 실패할 때 서비스가 어떻게 degrade 하는지에 대한 계약을 소유한다. 검증 경로의 캐시 장애는 인증을 멈추면 안 되고, revoke 처럼 보안에 영향을 주는 경로의 장애는 호출자에게 전파되어야 한다.

**실행 명령:** 도메인 전용 스크립트는 없다.

```bash
npx vitest run -c __tests__/vitest.config.ts __tests__/chaos
```

---

### TC-C-001: api-key 포트 장애 degrade 계약

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-C-001 |
| **파일** | `__tests__/chaos/api-key-port-faults.test.ts` |
| **대상** | `src/core/api-key/api-key.service.ts`: `validateApiKey()`, `updateApiKey()`, `deleteApiKey()` |
| **우선순위** | High |
| **전제조건** | cache 포트 메서드가 `new Error('redis down')` 을 throw 하도록 주입 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `cache.getValidation` throw 상태에서 `validateApiKey()` | `valid: true`, `repo.findByHash` 호출 (miss 로 처리) |
| 2 | `cache.setValidation` throw 상태에서 검증 성공 | 오류 전파 없이 유효 결과 반환 |
| 3 | 만료된 캐시 적중 + `cache.invalidate` throw + repo `null` | 오류 전파 없이 `valid: false` |
| 4 | `cache.invalidate` throw 상태에서 `updateApiKey()`·`deleteApiKey()` | 둘 다 `redis down` 으로 reject (revoke 확실성) |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)
- **관련 문서:** [chaos-gap-scenarios.md](../../__tests__/docs/scenarios/chaos-gap-scenarios.md), [chaos-gap-testcases.md](../../__tests__/docs/testcases/chaos-gap-testcases.md)

---

### TC-C-002: refresh 토큰 저장소 장애 시 갱신·로그아웃 동작 🔲 계획

| 항목 | 내용 |
|------|------|
| **시나리오** | SC-C-002 |
| **파일** | `__tests__/chaos/refresh-token-store-faults.test.ts` (신규) |
| **대상** | `src/core/auth/services/token-refresh.service.ts`: `refresh()`, `revokeByToken()` / `src/core/auth/services/refresh-token-store.ts`: `IRefreshTokenStore` (선택 메서드 `markUsedIfUnused` 포함) / `src/next/auth-handlers/refresh.handler.ts`: `createRefreshHandler()` / `logout.handler.ts`: `createLogoutHandler()` |
| **우선순위** | High |
| **전제조건** | `IRefreshTokenStore` 의 메서드 하나씩을 `new Error('store down')` 등으로 throw 하도록 교체한 페이크, UserRepository 페이크 |
| **테스트 데이터** | refresh 토큰 `{ jti: 'J1', familyId: 'F1' }`, `{ jti: 'J2', familyId: 'F2' }` |

| # | 단계 | 예상 결과 (현재 소스 기준) |
|---|------|---------|
| 1 | `isFamilyRevoked` 가 throw 할 때 `refresh()` | 원본 `Error('store down')` 으로 reject (`AuthError` 로 감싸지 않음, fail-closed) |
| 2 | 같은 조건에서 `createRefreshHandler()` 요청 | `status: 401`, body `{ success: false, error: 'Token refresh failed' }` (AuthError 가 아닌 오류 분기) |
| 3 | `isUsed` 가 throw 할 때 `refresh()` | 사용자 조회 전에 reject |
| 4 | `register` 가 throw 할 때 `refresh(t2)` | reject, 그러나 `J2` 는 이미 used 로 기록됨 |
| 5 | 단계 4 이후 같은 토큰으로 재시도 | `TOKEN_REUSE_DETECTED` 로 reject, `F2` family revoke (사용자는 강제 로그아웃됨) |
| 6 | `revokeFamily` 가 throw 할 때 로그아웃 요청 | `status: 200`, `success: true`, 쿠키 삭제, `logger.debug('Logout: refresh token revoke skipped', ...)` |

- **자동화:** 가능 ✅
- **근거:** 단계 1 과 4·5 는 소스 확인 후 스크래치 실행으로 같은 결과를 재현했다.
- **선행 조건:** 단계 4·5 는 `markUsed` 기록 뒤 선택 훅 `register` 가 실패하면 클라이언트가 새 토큰을 받지 못한 채 구 토큰으로 재시도하게 되어 family 전체가 폐기되는 흐름이다. 감사용 선택 훅 장애가 로그아웃으로 이어지는 동작을 계약으로 둘지 결정이 필요하다.
- **2026-09-16 변경 반영:** `markUsedIfUnused` 를 구현한 저장소(캐시 기반 store 포함)에서는 회전 시점의 소비 기록이 `markUsed` 대신 `markUsedIfUnused` 로 바뀌었다(`977efc2`). 소비를 기록한 뒤 `register` 가 실패하면 재시도가 재사용으로 판정되는 단계 4·5 의 흐름은 그대로이다. `markUsedIfUnused` 자체가 throw 하면 새 토큰 발급·`register`·family 무효화 없이 원본 오류로 reject 하며, 이 동작은 TC-U-007 단계 8 이 단위 수준에서 검증한다. 이 TC 는 결함 수정 대상이 아니었으므로 🔲 계획으로 유지한다.

---

## 분류 요약

| 유형 | 현재 파일 수 | 현재 테스트 수 | SC 수 (완료/계획) | TC 수 (완료/계획) | 실행 스크립트 |
|------|------------|-------------|-----------------|-----------------|--------------|
| **Unit** | 78개 | 1,814개 | 27 (25/2) | 31 (29/2) | `test:unit` (API 20개 파일 포함 실행) |
| **Integration** | 3개 | 22개 | 3 (3/0) | 3 (3/0) | `test:integration` |
| **API** | 20개 | 264개 | 11 (10/1) | 11 (10/1) | 없음 |
| **E2E** | 1개 | 7개 | 2 (2/0) | 2 (2/0) | 없음 |
| **Security** | 14개 | 283개 | 8 (8/0) | 8 (8/0) | `test:security` |
| **Performance** | 5개 | 98개 | 2 (2/0) | 2 (2/0) | `test:performance` (Load/Stress 1개 파일 포함 실행) |
| **Accessibility** | 0개 | 0개 | 0 | 0 | `test:accessibility` (디렉토리 없음, 종료 코드 1) |
| **Load/Stress** | 1개 | 2개 | 2 (1/1) | 2 (1/1) | 없음 |
| **Smoke** | 1개 | 330개 | 1 (1/0) | 1 (1/0) | 없음 |
| **Chaos** | 1개 | 4개 | 2 (1/1) | 2 (1/1) | 없음 |
| **합계** | **124개** | **2,824개** | **58 (53/5)** | **62 (57/5)** | |

파일 수와 테스트 수는 2026-09-16 실측값이다. 2026-09-13 판(121개 파일, 2,723건)과 비교하면 신규 파일 3개(`unit/error/prisma-error-map-contract.test.ts` 37건, `unit/cache/cache-wrapper.test.ts` 19건, `integration/auth/token-rotation-flow.integration.test.ts` 8건)가 추가되었다. 기존 파일 5개도 늘었다: `unit/utils/csv-export.test.ts` 29 → 43, `integration/cache.integration.test.ts` 6 → 12, `unit/auth/services/token-refresh.service.test.ts` 12 → 17, `unit/auth/services/cache-token-stores.test.ts` 11 → 18, `build/consumer-runtime.test.ts` 2 → 7. 합계 101건이 늘었다. 2026-09-13 판에서 허위 양성으로 판정한 2개 파일은 교체했으므로 해당 TC-U-028·TC-I-002 를 ✅ 완료로 분류했다.

**물리 디렉토리와 문서 도메인 대응**

| 물리 디렉토리 | 파일 | 테스트 | 문서 도메인 배분 |
|--------------|------|--------|-----------------|
| `__tests__/unit/` | 98 | 2,078 | Unit 78/1,814 + API 20/264 |
| `__tests__/integration/` | 3 | 22 | Integration 3/22 |
| `__tests__/security/` | 14 | 283 | Security 14/283 |
| `__tests__/performance/` | 6 | 100 | Performance 5/98 + Load/Stress 1/2 |
| `__tests__/build/` | 2 | 337 | E2E 1/7 + Smoke 1/330 |
| `__tests__/chaos/` | 1 | 4 | Chaos 1/4 |
| **합계** | **124** | **2,824** | |

2026-09-16 갱신 후 스크립트로 다시 대조한 결과, 124개 테스트 파일이 모두 이 문서의 TC "파일" 칸에 등장하며 누락은 0개이다.

---

## 도메인 적용성 판정

사전 조사 문서(`WITHWIZ_PACKAGES_TEST_AUDIT.md`)의 판정표에서 toolkit 열을 옮기고, 이번 실측으로 확인한 근거를 적는다.

| 도메인 | 판정 | 근거 |
|--------|------|------|
| Unit | 적용 | 78개 파일·1,814건으로 가장 두껍고 api-key·auth·cache·config·error·utils 핵심 모듈을 모두 포함한다 |
| API | 적용(재해석) | HTTP 서버가 없어 `src/next/` 핸들러·미들웨어·프록시·oapi 의 요청/응답 계약으로 재정의했고 20개 파일·264건이 해당한다 |
| Integration | 적용 | 3개 파일·22건이 api-key 수명주기, 캐시 계층 조합(초기화·팩토리·래퍼·무효화·Redis 폴백), 인증 서비스와 캐시 기반 토큰 저장소 조합을 실제 모듈로 검증한다. 2026-09-13 판에서 소스를 실행하지 않던 6건은 교체했다 |
| E2E | 재해석 적용 | dist 를 import 해 실행하는 소비자 여정 1개 파일·7건이 api-key 여정과 Prisma 오류 분류 여정을 다룬다 |
| Security | 적용(강함) | 14개 파일·283건이 JWT 알고리즘 혼동, OAuth CSRF, 비밀번호 해싱, CORS 반사, 오류 정보 노출, XSS 를 다룬다 |
| Accessibility | 미적용 | 렌더링 UI 가 없고 React 계층은 0.8.0 에서 `@withwiz/ui` 로 분리되었다 |
| Performance | 적용 | 처리 시간 상한을 단언하는 테스트는 3건(api-key hot path 2, noop 오버헤드 1)이고 나머지 95건은 대용량 캐시 기능 검증이다 |
| Load/Stress | 재해석 적용 | 동시 호출 일관성 2건이 있다. 2026-09-13 조사에서 재현된 refresh 토큰 동시 회전 경쟁은 2026-09-16 에 수정되었고 TC-I-003 이 검증한다 |
| Smoke | 적용 | exports 데이터로 생성한 330건이 dist 파일 존재·타입 선언·번들 오염·메타데이터를 검증한다 |
| Chaos | 적용 | api-key 포트 장애 degrade 계약 4건이 있으나 refresh 토큰 저장소 장애는 비어 있다 |

---

## 우선순위 갭

### 계획(🔲) 항목과 선행 조건

| 순위 | TC | 내용 | 우선순위 | 선행 조건 |
|------|----|------|---------|----------|
| 1 | TC-A-011 | `init-request`·`error-handler`·`response-logger` 미들웨어 실제 실행 | High | 없음 |
| 2 | TC-C-002 | refresh 토큰 저장소 장애 시 갱신·로그아웃 동작 | High | `register` 훅 실패가 family 폐기로 이어지는 동작의 계약 여부 결정 |
| 3 | TC-L-002 | 인메모리 캐시 카운터·용량 동시 호출 일관성 | Medium | 없음 |
| 4 | TC-U-030 | GeoIP 공급자 구현 4종과 팩토리 | Low | 정적 공급자 목록의 테스트 간 정리 절차 |
| 5 | TC-U-031 | 브라우저용 JWT 클라이언트 유틸 | Low | 파일 단위 jsdom 지정, `atob()` 의 base64url 처리 결함 여부 결정 |

2026-09-16 에 2026-09-13 판의 순위 1~4, 7, 8 (TC-I-002, TC-U-028, TC-U-027, TC-E-002, TC-I-003, TC-U-029)을 완료했다. 선행 결정은 다음과 같이 확정했다.

- **TC-U-027:** `handlePrismaError()` 도 공통 매핑표를 단일 기준으로 삼는다 (P2011 → 400, P2003 → 400).
- **TC-U-029:** `withCache()` 는 원본 함수를 호출당 최대 한 번만 실행한다.
- **TC-I-003:** 동시 회전 경쟁은 저장소의 선택적 원자 연산(`markUsedIfUnused`)으로 해결하고, 동시 갱신의 패자는 재사용으로 판정한다.
- **TC-I-002:** import 순서에 따른 `cache` 상수의 Noop 고정은 결정하지 않았으므로 테스트로 고정하지 않았다.

### 결정 대기 사항 (테스트로 고정하지 않음)

| 항목 | 현재 동작 | 관련 TC |
|------|----------|--------|
| `cache`·`geoCache` 상수의 평가 시점 | `initializeCache()` 전에 import 하면 Noop 으로 고정되어 `invalidateCache` 가 no-op | TC-I-002 |
| `withCache()` 미초기화 호출 | fetch 를 실행하지 않고 `ConfigurationError` 로 reject (`getCacheManager()` 는 Noop degrade) | TC-I-002 |
| Redis 계열 캐시 매니저의 원자 연산 | `RedisCacheManager`·`HybridCacheManager` 에 `setIfNotExists` 가 없어, 캐시 기반 refresh 토큰 저장소를 그대로 주입하면 여러 인스턴스 사이의 동시 회전을 막지 못함 | TC-I-003 |
| CSV 파일명 날짜 | UTC 날짜를 사용해 한국 시간 00:00~09:00 에는 전날 날짜가 붙음 | TC-U-028 |

### 사전 조사 우선순위 갭 8번 반영

사전 조사 문서가 "Prisma 오류 분류 영역 문서 커버리지 0" 으로 기록한 항목은 TC-U-018 (✅ 완료, 25건)로 문서화했다. 조사 당시 `fix/prisma-error-classification` 브랜치에만 있던 수정은 현재 develop 의 `fb07def` 로 병합되어 0.15.0 에 포함되어 있다. 2026-09-13 판에서는 분류 기준표 중 P2011 → 400 이 매핑표에만 정의되어 있고 이를 단언하는 테스트가 없어 TC-U-027 로 계획했다. 2026-09-16 에 TC-U-027 (37건)과 TC-E-002 (dist 5건)로 완료했다.

### 실행 스크립트 갭 (package.json 은 수정하지 않음)

| 항목 | 현재 상태 |
|------|----------|
| `test:accessibility` | 존재하지 않는 `__tests__/accessibility` 를 가리켜 `No test files found` 로 종료 코드 1 을 반환한다 |
| API·E2E·Smoke·Load/Stress·Chaos 스크립트 | 없음. 각 절의 `npx vitest run` 명령으로 실행해야 한다 |
| `test:unit`, `test:performance` | 각각 API 20개 파일, Load/Stress 1개 파일을 함께 실행하므로 도메인 단위 실행과 결과 수가 다르다 |
| 잠금 파일 | `package-lock.json` 만 있고 `pnpm-lock.yaml` 이 없어 `pnpm install --frozen-lockfile` 이 실패한다 |
| 커버리지 임계값 | `__tests__/vitest.config.ts` 에 없음 |

### 테스트 품질 발견 사항

| 구분 | 위치 | 내용 |
|------|------|------|
| 허위 양성 (목 객체만 검증) | `__tests__/integration/cache.integration.test.ts` (2026-09-13 판 6건) | 소스를 import 하지 않고 테스트 안의 `mockRedis`·`Map` 에 넣은 값을 다시 단언했다. 2026-09-16 `610750c` 에서 실제 모듈 조합 12건으로 교체해 해소 |
| 허위 양성 (구현 복제) | `__tests__/unit/utils/csv-export.test.ts` (2026-09-13 판 29건) | 소스 대신 복제본을 검증했고 복제본이 이미 소스와 달랐다 (`boolFormatter.korean`, `dateFormatter.custom`). 2026-09-16 `e37468c` 에서 소스 import 방식으로 교체해 해소 |
| 항상 참인 비교 | `__tests__/security/error/error-info-exposure.test.ts` `should return the same error code for "user not found" and "wrong password"` | 똑같이 생성한 `AuthError` 두 개를 비교한다 |
| 이름과 다른 단언 | `__tests__/unit/utils/error-processor.test.ts` `maps P2003 to 400 bad request (business rule)` | 이름은 400 이지만 실제로 422 를 단언했다. 2026-09-16 `c07a669` 에서 이름을 `maps P2003 to 400 per the shared Prisma error map (not 422)` 로 바꾸고 400 을 단언해 해소 |
| 존재 확인만 하는 단언 | `unit/utils/short-code-generator.test.ts:68`, `unit/utils/sanitizer.test.ts:317`, `security/utils/sanitizer.test.ts:325`, `unit/oapi/openapi-spec.test.ts:10`, `unit/cache/cache-fallback.test.ts:141` | 이름이 뜻하는 동작(모호 문자 배제, CSV 수식 방어, paths 보존, 폴백 값 반환) 대신 `toBeDefined()` 또는 호출 여부만 확인한다 |
| 중복 스위트 | `unit/utils/sanitizer.test.ts` ↔ `security/utils/sanitizer.test.ts`, `unit/utils/utils.test.ts` ↔ 모듈별 utils 파일, `unit/system/system.test.ts` ↔ `system-utils.test.ts`·`health-check.test.ts` | 같은 함수를 여러 파일에서 반복 검증한다. sanitizer 두 파일은 40건의 이름과 단언이 거의 같다 |
| 기존 감사 누락 | `__tests__/docs/FALSE_POSITIVE_AUDIT.md` (2026-07-12) | CRITICAL·HIGH 0건, placeholder 0건으로 판정했으나 위 허위 양성 2개 파일을 포함하지 않았다 |

"존재 확인만 하는 단언" 은 `toBeDefined`·`toBeTruthy`·`not.toThrow` 만 쓰는 테스트를 스크립트로 추출한 43건 가운데, 이름과 단언이 어긋나는 사례만 골랐다. 나머지는 예외가 없음을 확인하는 것이 목적인 정상 사례이다.

### 커버리지 0% 소스 파일 (2026-09-16 재측정)

| 파일 | 측정 줄 수 | 계획 TC |
|------|----------|--------|
| `src/core/auth/jwt/client.ts` | 111 | TC-U-031 |
| `src/core/geolocation/providers/index.ts`, `ip-api-provider.ts`, `ipapi-co-provider.ts`, `ipgeolocation-provider.ts`, `maxmind-provider.ts` | 20, 8, 8, 15, 9 | TC-U-030 |
| `src/next/middleware/error-handler.ts`, `init-request.ts`, `response-logger.ts` | 22, 10, 22 | TC-A-011 |
| `src/core/system/cpu.ts`, `disk.ts`, `memory.ts`, `network.ts`, `index.ts` | 137, 120, 185, 161, 44 | 미정의 (OS 명령 의존 수집기) |
| `src/next/error/ErrorBoundary.tsx` | 26 | 미정의 (유일한 React 표면) |
| `src/core/error/friendly-messages.ts` | 10 | 미정의 (`friendly-messages-v2.ts` 가 별도로 존재) |
| `src/core/auth/password/client-helper.ts` | 14 | 미정의 |
| `src/core/constants/messages.ts`, `pagination.ts`, `src/core/types/qr-code.ts` | 4, 5, 2 | 해당 없음 (상수·타입) |

2026-09-13 판의 0% 목록에 있던 `src/core/cache/cache-wrapper.ts`·`cache-invalidation.ts` (TC-U-029)는 각각 89.7%·90%, `src/next/utils/csv-export.ts`·`csv-export-format.ts` (TC-U-028)는 각각 98.5%·100% (줄 기준)로 목록에서 빠졌다. 나머지 0% 파일 20개는 2026-09-13 판과 같다.

낮은 커버리지 파일: `src/next/utils/api-helpers.ts` 6.66% (`requireAdmin()` 만 테스트됨), `src/next/utils/cors.ts` 43.67%, `src/core/error/extract-error-info.ts` 57.89%. `src/core/cache/cache-factory.ts` 는 2026-09-13 판 21.95% 에서 TC-I-002 교체 뒤 68.29% 가 되었다.

---

## 이전 문서 정리

사전 조사 문서의 판정과 워크트리 내용을 대조한 뒤, 1세대·2세대 문서 5개를 `git rm` 으로 삭제했다.

| 삭제 파일 | 세대 | 대조 결과 (삭제 사유) |
|----------|------|---------------------|
| `__tests__/docs/TEST_PLAN.md` | 1세대 | `cd packages/@withwiz/toolkit && npx jest`, `jest.config.js` 임계값 등 Jest·모노레포 하위 패키지 기준으로 작성되었고, 10절에서 `src/` 에 없는 Hooks 모듈(useDebounce, useTimezone, useExitIntent, useDataTable)을 다룬다 |
| `__tests__/docs/TEST_SCENARIOS.md` | 1세대 | `jest.config.js` 와 `unit/password.test.ts` 같은 현재 없는 평면 경로 구조를 기준으로 시나리오를 정의한다 |
| `__tests__/docs/PROGRESS.md` | 1세대 | 총 테스트 케이스 592개·통과 589개로 기록되어 2026-09-13 실측 2,723건과 다르고, 향후 작업에 Hooks 모듈을 포함한다 |
| `__tests__/docs/TESTING_ANALYSIS.md` | 2세대 | JWT Token Creation 6건을 실패(Failing) 상태로 기록했으나 실측 실패 0건이고, 없는 `__tests__/accessibility/hooks/hooks.test.tsx`·`unit/error/error-recovery.test.ts` 와 죽은 링크 `./CLAUDE.md`·`./docs/FOLDER_STRUCTURE.md` 를 참조한다 |
| `__tests__/docs/UNIMPLEMENTED_TESTS_REPORT.md` | 2세대 | 실패 6건·스킵 8건으로 기록했으나 실측 실패 0·스킵 0 이고, 없는 `__tests__/accessibility/` 디렉토리를 근거로 삼는다 |

- **날짜 표기 차이:** 사전 조사 문서는 1세대를 2026-02 로 표기했으나, git 기록상 세 파일은 초기 커밋(2026-03-03)에 들어왔고 `PROGRESS.md` 본문은 "최종 업데이트: 2024-02-01" 이다. 내용 판정은 조사 결과와 일치하므로 삭제했다.
- **링크 정리:** `__tests__/README.md` 와 `__tests__/README.ko.md` 의 문서 절이 삭제한 `TEST_PLAN.md`·`TEST_SCENARIOS.md` 를 가리키고 있어, 이 문서와 3세대 문서로 링크를 교체했다. README 본문의 Jest 명령과 임계값 설명은 이번 범위 밖이라 그대로 두었다.
- **남은 참조:** 테스트 파일 4개(`unit/error/app-error.test.ts`, `unit/error/error-codes.test.ts`, `security/auth/auth-jwt.test.ts`, `security/validators/validation-constants.test.ts`)의 머리 주석 `Based on: TEST_SCENARIOS.md` 는 테스트 코드 수정 금지 원칙에 따라 유지했다. 이 파일들의 기존 ID 는 아래 레거시 ID 대응표로 추적한다.
- **유지한 문서:** 3세대 문서(`__tests__/docs/scenarios/` 10개, `__tests__/docs/testcases/` 8개, `__tests__/docs/FALSE_POSITIVE_AUDIT.md`)는 api-key 모듈 전용 산출물로 유지한다.

---

## 3세대 문서 연계와 ID 대응표

### 3세대 (api-key 전용) ID 대응

| 3세대 시나리오 ID | 3세대 케이스 ID | 새 SC | 새 TC | 테스트 파일 | 대조 결과 |
|-----------------|---------------|-------|-------|-----------|----------|
| SC-UNIT-AKERR-001~002 | TC-UNIT-AKERR-001~004 | SC-U-002 | TC-U-002 | `unit/api-key/errors.test.ts` | 일치. 케이스 문서의 시나리오 칸은 `SC-AKERR-001` 처럼 `UNIT-` 을 뺀 약칭을 쓴다 |
| SC-UNIT-AKSVC-001~006 | TC-UNIT-AKSVC-101~109 | SC-U-001 | TC-U-001 | `unit/api-key/api-key.service.test.ts` | 문서의 103·104 는 테스트 한 건 `TC-UNIT-AKSVC-103/104` 로 합쳐져 있다 |
| SC-API-OAPI-001~005 | TC-API-OAPI-001~007 | SC-A-001 | TC-A-001 | `unit/oapi/api-key-auth.test.ts` | 코드에만 `TC-API-OAPI-008~010` 3건이 추가로 있다 |
| SC-INT-AK-001~002 | TC-INT-AK-001~002 | SC-I-001 | TC-I-001 | `integration/api-key/api-key-flow.integration.test.ts` | 일치 |
| SC-E2E-AK-001~002 | TC-E2E-AK-001~002 | SC-E-001 | TC-E-001 | `build/consumer-runtime.test.ts` | 일치 |
| SC-SEC-AK-001~004 | TC-SEC-AK-001~004 | SC-S-001 | TC-S-001 | `security/api-key/api-key-secrets.test.ts` | 일치 |
| SC-PERF-AK-001~002 | TC-PERF-AK-001~002 | SC-P-001 | TC-P-001 | `performance/api-key/api-key-hotpath.test.ts` | 일치 |
| SC-LOAD-AK-001~002 | TC-LOAD-AK-001~002 | SC-L-001 | TC-L-001 | `performance/api-key/api-key-concurrency.test.ts` | 일치 |
| SC-CHAOS-AK-001~004 | TC-CHAOS-AK-001~004 | SC-C-001 | TC-C-001 | `chaos/api-key-port-faults.test.ts` | 일치. 케이스 문서에 "001~003 은 실패 예상" 이라는 작성 당시 메모가 남아 있으나 현재 4건 모두 통과한다 |
| (smoke-gap, ID 없음) | 없음 | SC-SM-001 | TC-SM-001 | `build/exports-integrity.test.ts` | 신규 케이스 없음 판정과 일치 |
| (accessibility-gap, ID 없음) | 없음 | 해당 없음 | 해당 없음 | 없음 | 검증 표면 없음 판정과 일치 |

### 테스트 이름에 남아 있는 기존 ID (레거시)

| 테스트 이름의 ID | 출처 | 파일 | 새 TC |
|----------------|------|------|-------|
| SC-AUTH-JWT-001~004, TC-AUTH-JWT-001~010b | 1세대 `TEST_SCENARIOS.md` (삭제) | `security/auth/auth-jwt.test.ts` | TC-S-002 |
| SC-ERR-001~010, TC-ERR-001~012 | 1세대 `TEST_SCENARIOS.md` (삭제) | `unit/error/app-error.test.ts` | TC-U-014 |
| SC-CONST-ERR-001~004, TC-CONST-ERR-001~009 | 1세대 `TEST_SCENARIOS.md` (삭제) | `unit/error/error-codes.test.ts` | TC-U-014 |
| SC-CONST-VAL-001~003, TC-CONST-VAL-001~002 | 1세대 `TEST_SCENARIOS.md` (삭제) | `security/validators/validation-constants.test.ts` | TC-S-005 |
| SC-INT-CACHE-001~005, TC-INT-CACHE-001~023 (2026-09-16 교체로 테스트 이름에서 제거) | 파일 주석의 `docs/testing/02-integration/02-cache.md` (저장소에 없음) | `integration/cache.integration.test.ts` | TC-I-002 |
| SC-UNIT-OPTAUTH-001, TC-UNIT-OPTAUTH-001~005 | 파일 주석의 `docs/testing/03-api/25-url-entry-optional-auth.md` (저장소에 없음) | `unit/middleware/optional-auth-middleware.test.ts` | TC-A-005 |
| SC-UNIT-COOKIE-001~002, TC-UNIT-COOKIE-001~014 | 출처 문서 없음 | `unit/auth/cookie.test.ts` | TC-U-005 |
| SC-UNIT-AUTHCOOKIE-001~002, TC-UNIT-AUTHCOOKIE-001~007 | 출처 문서 없음 | `unit/middleware/auth-cookie-extraction.test.ts` | TC-A-005 |
| SC-UNIT-ORIGIN-001, TC-UNIT-ORIGIN-001~009 | 출처 문서 없음 | `unit/middleware/origin-verification.test.ts` | TC-A-008 |
| SC-API-RLFIX-001~002, TC-API-RLFIX-001~014, SC-UNIT-RLTYPE-001, TC-UNIT-RLTYPE-001~004 | 출처 문서 없음 | `unit/middleware/rate-limit-is-enabled.test.ts` | TC-A-009 |
| SC-UNIT-VAL-001~003, TC-UNIT-PWD-001~008, TC-UNIT-SCHEMA-001~002 | 출처 문서 없음 | `security/validators/validators.test.ts` | TC-S-005 |
| SC-E2E-OAUTH-SEL-003, TC-E2E-OAUTH-SEL-020~025 | 출처 문서 없음 | `security/auth/oauth-prompt-parameter.test.ts` | TC-S-003 |
| SC-UNIT-MEMLRU-001~007, TC-UNIT-MEMLRU-001~010 | 출처 문서 없음 | `performance/cache/cache-limit-lru.test.ts` | TC-P-002 |
| SC-UNIT-REDIS-OPT-003, TC-INT-REDIS-OPT-020~024 | 출처 문서 없음 | `performance/cache/redis-delete-pattern-scan.test.ts` | TC-P-002 |
| SC-UNIT-CSV-001~004 (describe 이름에 유지), TC-UNIT-CSV-001~012 (2026-09-16 교체로 테스트 이름에서 제거) | 출처 문서 없음 | `unit/utils/csv-export.test.ts` | TC-U-028 |
| SC-UNIT-TG-001~007, TC-UNIT-TG-001~026 | 출처 문서 없음 | `unit/utils/type-guards.test.ts` | TC-U-025 |
| SC-UNIT-UTIL-001~006, TC-UNIT-URL/SC/IP/SAN/FMT/TZ-* | 출처 문서 없음 | `unit/utils/utils.test.ts` | TC-U-026 |

레거시 ID 는 테스트 이름을 바꾸지 않는 한 유지되므로, 이 표를 기준으로 새 TC 와 연결한다.

---

## 리뷰 체크리스트

- [x] 10개 도메인 모두 판정 (Accessibility 미적용 근거 포함)
- [x] 124개 테스트 파일이 모두 TC "파일" 칸에 등장 (2026-09-16 스크립트 재대조, 누락 0)
- [x] 파일별 테스트 수를 JSON 리포터 실측값으로 기재하고 합계 2,824건 일치 확인 (2026-09-16)
- [x] 완료 TC 의 단계·예상 결과를 실제 테스트 이름과 단언에서 발췌
- [x] 계획 TC 는 대상 소스를 읽고 작성, 동작이 불분명한 4개 흐름은 워크트리 밖 스크래치 실행으로 재현
- [x] Prisma 오류 분류 기준표 (P2002 → 409, P2025 → 404, P2011 → 400, `PrismaClientValidationError` → 400) 기재
- [x] 3세대 문서 링크와 ID 대응표 기재
- [x] 1세대·2세대 문서 5개를 내용 대조 후 삭제
- [x] 허위 양성 2개 파일 교체 (TC-I-002, TC-U-028, 2026-09-16)
- [x] 계획 TC 의 선행 결정 사항 중 3건 확정 (TC-U-027·029, TC-I-003, 2026-09-16)
- [ ] 남은 결정 사항 확정 필요 (TC-U-031 `atob()` 처리, TC-C-002 `register` 훅 장애, TC-I-002 `cache` 상수 평가 시점과 `withCache()` 미초기화 정책)
- [ ] 도메인별 실행 스크립트 정비 필요 (이번 작업에서 package.json 미수정)
- [ ] 커버리지 임계값 설정 필요 (현재 미설정)
