# @withwiz/toolkit 도메인별 테스트 계획

> **작성일**: 2026-03-14
> **대상 버전**: 0.2.0
> **목표 커버리지**: >80% (전 모듈)
> **테스트 프레임워크**: Vitest (node environment)

---

## 목차

1. [현황 요약](#1-현황-요약)
2. [도메인별 테스트 계획](#2-도메인별-테스트-계획)
   - [2.1 Auth (인증)](#21-auth-인증)
   - [2.2 Cache (캐싱)](#22-cache-캐싱)
   - [2.3 Components/UI (UI 컴포넌트)](#23-componentsui-ui-컴포넌트)
   - [2.4 Constants (상수)](#24-constants-상수)
   - [2.5 Error (에러 처리)](#25-error-에러-처리)
   - [2.6 Geolocation (지오로케이션)](#26-geolocation-지오로케이션)
   - [2.7 Hooks (React 훅)](#27-hooks-react-훅)
   - [2.8 Logger (로깅)](#28-logger-로깅)
   - [2.9 Middleware (미들웨어)](#29-middleware-미들웨어)
   - [2.10 Storage (스토리지)](#210-storage-스토리지)
   - [2.11 System (시스템 모니터링)](#211-system-시스템-모니터링)
   - [2.12 Utils (유틸리티)](#212-utils-유틸리티)
   - [2.13 Validators (검증)](#213-validators-검증)
3. [우선순위 및 실행 계획](#3-우선순위-및-실행-계획)

---

## 1. 현황 요약

### 테스트 파일 현황 (27개)

| 카테고리 | 파일 수 | 대상 모듈 |
|---------|--------|----------|
| Unit | 13 | error(3), geolocation(1), logger(1), middleware(2), utils(6) |
| Security | 7 | auth(4), utils/sanitizer(1), validators(2) |
| Performance | 4 | cache(4) |
| Integration | 1 | cache(1) |
| Accessibility | 2 | components(1), hooks(1) |

### 모듈별 테스트 커버리지 현황

| 모듈 | 소스 파일 수 | 테스트 파일 수 | 커버리지 등급 | 상태 |
|------|------------|-------------|------------|------|
| auth | ~15 | 4 (security) | ★★★☆☆ | 보안 테스트 존재, 단위 테스트 부족 |
| cache | ~14 | 5 (perf+integ) | ★★★★☆ | 성능/통합 양호, 팩토리 테스트 부족 |
| components/ui | ~14 | 1 (a11y) | ★☆☆☆☆ | 거의 미테스트 |
| constants | ~6 | 0 직접 | ★★☆☆☆ | error-codes만 간접 테스트 |
| error | ~20+ | 3 (unit) | ★★★☆☆ | core만 테스트, components/hooks/recovery/logging 미테스트 |
| geolocation | ~8 | 1 (unit) | ★★☆☆☆ | 기본만 테스트, providers 미테스트 |
| hooks | 4 | 1 (a11y) | ★★☆☆☆ | 접근성만, 기능 테스트 부족 |
| logger | 1 | 1 (unit) | ★★★★☆ | 양호 |
| middleware | ~11 | 2 (unit) | ★★☆☆☆ | optional-auth, rate-limit만 |
| storage | 1 | 0 | ☆☆☆☆☆ | 미테스트 |
| system | ~8 | 0 | ☆☆☆☆☆ | 미테스트 |
| utils | ~17 | 8 (unit+security) | ★★★☆☆ | 주요 유틸 테스트됨, 일부 누락 |
| validators | 1 | 2 (security) | ★★★★☆ | 양호 |

---

## 2. 도메인별 테스트 계획

### 2.1 Auth (인증)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `security/auth/auth-jwt.test.ts` | **수정** | 토큰 만료, 리프레시 토큰 교체 시나리오 추가 |
| `security/auth/oauth.test.ts` | **수정** | provider별 에러 핸들링 케이스 추가 |
| `security/auth/oauth-prompt-parameter.test.ts` | **유지** | 충분한 커버리지 |
| `security/auth/password.test.ts` | **유지** | 충분한 커버리지 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/auth/prisma-user-repository.test.ts` | PrismaUserRepository | 높음 | - `findById`: 존재/미존재 사용자 조회<br>- `findByEmail`: 정상/미존재 이메일 조회<br>- `create`: 정상 생성, 중복 이메일 에러<br>- `update`: 부분 업데이트, 미존재 사용자<br>- `delete`: 정상 삭제, 미존재 사용자<br>- `updateLastLoginAt`: 타임스탬프 갱신 검증<br>- `verifyEmail`: 이메일 인증 플래그 변경 |
| `unit/auth/prisma-oauth-repository.test.ts` | PrismaOAuthAccountRepository | 높음 | - `findByProvider`: provider+id 조합 조회<br>- `findByUserId`: 사용자별 전체 계정 목록<br>- `create`: 토큰 포함 생성<br>- `update`: 토큰 갱신<br>- `delete`: 연결 해제 |
| `unit/auth/prisma-email-token-repository.test.ts` | PrismaEmailTokenRepository | 중간 | - `create`: 토큰 생성 및 만료시간 설정<br>- `findByEmailAndToken`: 유효/무효/만료 토큰 조회<br>- `delete`: 특정 토큰 삭제<br>- `deleteExpired`: 만료 토큰 일괄 삭제<br>- `markAsUsed`: 매직링크 사용 처리 |
| `unit/auth/jwt-manager.test.ts` | JWT 핵심 로직 | 높음 | - `signToken`: 페이로드 서명, 커스텀 만료<br>- `verifyToken`: 유효/만료/변조 토큰<br>- `refreshToken`: 리프레시 플로우<br>- 알고리즘 검증 (HS256/ES256) |
| `security/auth/token-blacklist.test.ts` | 토큰 블랙리스트 | 높음 | - 블랙리스트 등록/조회<br>- 만료된 블랙리스트 정리<br>- 동시성 처리 |

---

### 2.2 Cache (캐싱)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `performance/cache/cache-advanced.test.ts` | **유지** | TTL, 네임스페이스 등 충분 |
| `performance/cache/cache-limit-lru.test.ts` | **유지** | LRU 정책 검증 완료 |
| `performance/cache/cache-managers.test.ts` | **유지** | 매니저별 CRUD 검증 완료 |
| `performance/cache/redis-delete-pattern-scan.test.ts` | **유지** | SCAN 기반 삭제 검증 |
| `integration/cache.integration.test.ts` | **수정** | 하이브리드 캐시 전환 시나리오 추가 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/cache/cache-factory.test.ts` | CacheFactory | 높음 | - Redis/InMemory/Hybrid/Noop 백엔드 생성<br>- 환경변수 기반 자동 선택<br>- 잘못된 타입 에러 처리<br>- 싱글톤 보장 검증 |
| `unit/cache/cache-invalidation.test.ts` | 캐시 무효화 | 중간 | - 패턴 기반 무효화<br>- 태그 기반 무효화<br>- 계층적 키 무효화<br>- 무효화 이벤트 콜백 |
| `unit/cache/cache-defaults.test.ts` | 기본 설정 | 낮음 | - 기본 TTL 값 검증<br>- 기본 캐시 크기 검증<br>- 환경별 기본값 차이 |

---

### 2.3 Components/UI (UI 컴포넌트)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `accessibility/components/client-utils.test.ts` | **수정** | 컴포넌트별 접근성 테스트 분리 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/components/button.test.tsx` | Button | 높음 | - 각 variant 렌더링 (default, destructive, outline, secondary, ghost, link)<br>- 각 size 렌더링 (default, sm, lg, icon)<br>- onClick 이벤트 핸들링<br>- disabled 상태에서 클릭 무시<br>- asChild prop으로 다른 요소 렌더링<br>- className 병합 검증<br>- ref 전달 |
| `unit/components/data-table.test.tsx` | DataTable | 높음 | - 기본 테이블 렌더링 (헤더, 행, 셀)<br>- 정렬: 컬럼 클릭 시 asc/desc 전환<br>- 필터: 텍스트/셀렉트 필터 적용<br>- 페이지네이션: 페이지 이동, 페이지 크기 변경<br>- 검색: 디바운스 검색<br>- 선택: 개별/전체 선택, 선택 카운트<br>- 벌크 액션: 선택 항목에 대한 액션 실행<br>- 빈 데이터 상태 표시<br>- 로딩 상태 표시<br>- i18n 라벨 적용 |
| `unit/components/badge.test.tsx` | Badge | 중간 | - 각 variant 렌더링 (default, secondary, destructive, outline)<br>- 커스텀 className 병합<br>- children 렌더링 |
| `unit/components/alert.test.tsx` | Alert | 중간 | - 각 variant 렌더링<br>- title/description 표시<br>- 아이콘 렌더링 |
| `unit/components/table.test.tsx` | Table (기본) | 낮음 | - Table/TableHeader/TableBody/TableRow/TableCell 조합 렌더링<br>- className 전달 |
| `unit/components/select.test.tsx` | Select | 낮음 | - 옵션 렌더링 및 선택<br>- placeholder 표시<br>- disabled 상태<br>- onChange 콜백 |
| `unit/components/input.test.tsx` | Input | 낮음 | - 기본 렌더링<br>- type 속성 (text, password, email)<br>- onChange 이벤트<br>- disabled/readOnly 상태 |

---

### 2.4 Constants (상수)

#### 기존 테스트: 없음 (간접 테스트만 존재)

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/constants/error-codes.test.ts` | 에러 코드 유틸 | 높음 | - `getErrorInfo()`: 유효/무효 코드에 대한 반환값<br>- `getErrorByCode()`: 코드로 에러 정보 조회<br>- `getHttpStatus()`: 코드→HTTP 상태 매핑<br>- `getErrorCategory()`: 카테고리 분류 정확성<br>- `getDefaultErrorMessage()`: 기본 메시지 반환<br>- `getLogLevel()`: 에러 심각도별 로그 레벨<br>- `getAllErrorCodes()`: 전체 코드 목록 반환<br>- `getErrorCodesByCategory()`: 카테고리별 필터링<br>- `formatErrorMessage()`: 플레이스홀더 치환 |
| `unit/constants/pagination.test.ts` | 페이지네이션 상수 | 낮음 | - PAGINATION 기본값 정합성 (min ≤ default ≤ max)<br>- PAGE_SIZES 리소스별 값 존재 확인<br>- SORT_OPTIONS 유효성 |
| `unit/constants/security.test.ts` | 보안 상수 | 중간 | - JWT_DEFAULTS 알고리즘/만료 값 검증<br>- TOKEN 길이가 보안 기준 충족 (≥32 bytes)<br>- SECURITY_HEADERS 필수 헤더 존재 확인<br>- 만료 시간 정합성 (access < refresh) |

---

### 2.5 Error (에러 처리)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `unit/error/app-error.test.ts` | **수정** | static factory 메서드 (`fromKey`, `fromErrorInfo`, `from`) 테스트 추가, `toLogString()` 테스트 추가 |
| `unit/error/error-codes.test.ts` | **수정** → 이동 | `unit/constants/error-codes.test.ts`로 이동 (상수 도메인에 귀속) |
| `unit/error/error-recovery.test.ts` | **수정** | `FeatureDegradation` 클래스 테스트 추가 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/error/error-handler.test.ts` | errorToResponse, processError, withErrorHandler | 높음 | - `errorToResponse`: AppError→NextResponse 변환, HTTP 상태 코드 정확성<br>- `processError`: 일반 Error→AppError 변환, Prisma 에러 매핑 (P2000~P2025)<br>- `withErrorHandler`: 정상 핸들러 래핑, 에러 발생 시 표준 응답 반환<br>- `ErrorResponse`: 편의 메서드 (badRequest, unauthorized 등) 검증 |
| `unit/error/error-display.test.ts` | 에러 표시 유틸 | 중간 | - 사용자 친화적 메시지 변환<br>- locale별 메시지 매핑 |
| `unit/error/error-components.test.tsx` | ErrorPage, ErrorAlert, LoadingState, EmptyState | 중간 | - `ErrorPage`: 에러 코드/메시지 렌더링, 재시도 버튼<br>- `ErrorAlert`: variant별 스타일, 닫기 버튼<br>- `LoadingState`: 로딩 인디케이터 렌더링<br>- `EmptyState`: 빈 상태 메시지/아이콘 표시 |
| `unit/error/error-hooks.test.ts` | useErrorHandler | 중간 | - 에러 상태 설정/해제<br>- 에러 핸들러 콜백<br>- 에러 클리어 |
| `unit/error/error-logging.test.ts` | ErrorLogger, Transports | 낮음 | - `ErrorLogger`: 에러 로깅, 레벨 필터링<br>- `ConsoleTransport`: 콘솔 출력 형식<br>- `FileTransport`: 파일 기록 (mock)<br>- `SlackTransport`: 알림 전송 (mock)<br>- `SentryTransport`: 에러 리포팅 (mock) |
| `unit/error/circuit-breaker.test.ts` | CircuitBreaker | 높음 | - CLOSED→OPEN 전환 (실패 임계값 초과)<br>- OPEN→HALF_OPEN 전환 (타임아웃 후)<br>- HALF_OPEN→CLOSED 전환 (성공 시)<br>- HALF_OPEN→OPEN 전환 (재실패 시)<br>- 동시 요청 처리<br>- 커스텀 설정 (threshold, timeout) |
| `unit/error/retry.test.ts` | withRetry | 높음 | - 1회 성공: 즉시 반환<br>- N회 실패 후 성공: 재시도 횟수 검증<br>- 최대 재시도 초과: 최종 에러 throw<br>- 지수 백오프: 지연 시간 증가 검증<br>- 재시도 불가 에러: 즉시 throw |
| `unit/error/fallback.test.ts` | withFallback, withFallbackFn, withFallbackChain | 중간 | - `withFallback`: 에러 시 기본값 반환<br>- `withFallbackFn`: 에러 시 대체 함수 실행<br>- `withFallbackChain`: 체인 순서대로 시도, 모든 실패 시 에러 |

---

### 2.6 Geolocation (지오로케이션)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `unit/geolocation/geolocation.test.ts` | **수정** | BatchProcessor 동시성 테스트, 에러 복구 시나리오 추가 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/geolocation/provider-factory.test.ts` | GeoIPProviderFactory | 높음 | - `getAvailableProviders()`: 환경변수 기반 활성 프로바이더 목록<br>- `getProvider(name)`: 존재/미존재 프로바이더 조회<br>- `getOptimalProvider()`: 성능 기반 최적 선택<br>- `registerProvider()`: 커스텀 프로바이더 등록<br>- `unregisterProvider()`: 프로바이더 제거<br>- `getProviderStats()`: 통계 정보 정확성 |
| `unit/geolocation/providers.test.ts` | 개별 프로바이더 | 중간 | - `IPApiProvider`: API 호출 mock, 응답 파싱, 에러 핸들링<br>- `IPApiCoProvider`: API 호출 mock, 응답 파싱<br>- `IPGeolocationProvider`: API 호출 mock<br>- `MaxMindProvider`: 데이터베이스 조회 mock<br>- 공통: 타임아웃, 네트워크 에러, 잘못된 응답 형식 |
| `unit/geolocation/batch-processor.test.ts` | BatchProcessor | 중간 | - `processBatch`: 순차 처리, 진행률 콜백<br>- `processBatchWithRetry`: 실패 항목 재시도<br>- `processBatchConcurrent`: 병렬 처리, 동시성 제한<br>- 설정 업데이트/조회 |

---

### 2.7 Hooks (React 훅)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `accessibility/hooks/hooks.test.tsx` | **수정** | 각 훅별 기능 테스트 추가 (현재 접근성만) |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/hooks/use-data-table.test.ts` | useDataTable | 높음 | - 초기 데이터 로드 (fetchFn 호출)<br>- 필터 설정/변경 시 데이터 리페치<br>- 정렬 변경 시 데이터 리페치<br>- 페이지 이동/사이즈 변경<br>- 검색어 입력 (디바운스 적용)<br>- 선택: toggleSelection, selectAll, clearSelection<br>- bulkAction 실행 및 데이터 리프레시<br>- 에러 상태 핸들링<br>- 로딩 상태 전환 |
| `unit/hooks/use-debounce.test.ts` | useDebounce | 중간 | - 즉시 값 반환 안 함 (지연 대기)<br>- 지연 후 최종 값 반환<br>- 연속 호출 시 마지막 값만 반영<br>- 커스텀 딜레이 시간<br>- 컴포넌트 언마운트 시 타이머 정리 |
| `unit/hooks/use-exit-intent.test.ts` | useExitIntent | 낮음 | - 마우스 이탈 감지 콜백<br>- 민감도 설정<br>- 이벤트 리스너 정리 |
| `unit/hooks/use-timezone.test.ts` | useTimezone | 낮음 | - 브라우저 타임존 반환<br>- UTC 오프셋 계산<br>- 타임존 이름 포맷 |

---

### 2.8 Logger (로깅)

#### 기존 테스트 (유지)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `unit/logger/logger.test.ts` | **유지** | logInfo, logError, logWarn, logDebug 커버리지 양호 |

#### 신규 테스트: 없음

현재 logger.ts 단일 파일이며 기존 테스트로 충분합니다.

---

### 2.9 Middleware (미들웨어)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `unit/middleware/optional-auth-middleware.test.ts` | **유지** | 충분 |
| `unit/middleware/rate-limit-is-enabled.test.ts` | **유지** | 충분 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/middleware/auth-middleware.test.ts` | authMiddleware, adminMiddleware | 높음 | - `authMiddleware`: 유효 토큰→통과, 만료 토큰→401, 미제공→401, 블랙리스트 토큰→401<br>- `adminMiddleware`: admin 역할→통과, 일반 사용자→403<br>- `setAccessTokenBlacklistChecker`: 체커 주입 및 호출 검증<br>- `initializeAuthMiddleware`: 초기화 플로우 |
| `unit/middleware/cors-middleware.test.ts` | corsMiddleware | 높음 | - 허용된 Origin→CORS 헤더 설정<br>- 미허용 Origin→차단<br>- OPTIONS (preflight)→204 응답<br>- `getAllowedOrigins()`: 환경변수별 도메인 목록<br>- 와일드카드 origin 처리 |
| `unit/middleware/security-middleware.test.ts` | securityMiddleware | 높음 | - TRACE/TRACK 메서드→405 차단<br>- Content-Type 검증 (POST/PUT/PATCH)<br>- 보안 헤더 설정 (X-Frame-Options, CSP 등)<br>- `validateSecurityConfiguration()` 로깅 |
| `unit/middleware/error-handler-middleware.test.ts` | errorHandlerMiddleware | 중간 | - AppError→적절한 HTTP 응답<br>- 일반 Error→500 응답<br>- `createErrorResponse()`: 포맷 검증, requestId 포함<br>- 예상치 못한 에러 형태 처리 |
| `integration/middleware-chain.test.ts` | 미들웨어 조합 | 낮음 | - auth + rateLimit 조합<br>- cors + security + auth 조합<br>- 에러 전파 순서 |

---

### 2.10 Storage (스토리지)

#### 기존 테스트: 없음

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/storage/r2-storage.test.ts` | R2 스토리지 전체 | 높음 | - `isR2Enabled()`: 환경변수 설정/미설정 시<br>- `getConfig()`: 필수 환경변수 누락 시 에러, 정상 설정 반환<br>- `getClient()`: S3Client 싱글톤 생성 (mock)<br>- `uploadToR2()`: 정상 업로드, Content-Type 설정, 에러 (네트워크, 권한)<br>- `getFromR2()`: 정상 다운로드, 미존재 키→에러<br>- `deleteFromR2()`: 정상 삭제, 미존재 키 처리<br>- R2 비활성 시 각 함수 동작 |

> **참고**: S3Client는 `@aws-sdk/client-s3`를 vi.mock으로 처리

---

### 2.11 System (시스템 모니터링)

#### 기존 테스트: 없음

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/system/system-info.test.ts` | getSystemInfo, getSimpleSystemInfo | 높음 | - `getSystemInfo()`: 전체 시스템 정보 구조 검증 (cpu, memory, disk, network 포함)<br>- `getSimpleSystemInfo()`: 간소화된 정보 반환 검증<br>- 타임아웃 동작 검증 |
| `unit/system/cpu.test.ts` | getCpuInfo | 중간 | - CPU 사용량 반환값 구조 (system, process)<br>- os 모듈 mock 처리<br>- 플랫폼별 분기 검증 |
| `unit/system/memory.test.ts` | getMemoryInfo | 중간 | - 메모리 정보 구조 (total, free, used, percent, process)<br>- process.memoryUsage() mock<br>- 퍼센트 계산 정확성 |
| `unit/system/disk.test.ts` | getDiskInfo | 중간 | - 디스크 정보 구조 (total, used, free, percent)<br>- macOS/Linux 분기 처리 (child_process mock)<br>- 파싱 에러 핸들링 |
| `unit/system/network.test.ts` | getNetworkInfo | 낮음 | - 네트워크 정보 구조<br>- 속도 측정 (RX/TX rates)<br>- 연결 수 카운트 |
| `unit/system/environment.test.ts` | checkEnvironmentVariables | 중간 | - 필수 환경변수 모두 존재→성공<br>- 일부 누락→경고 목록 반환<br>- 선택적 변수 누락→정보 로그 |
| `unit/system/health-check.test.ts` | checkServiceHealth | 높음 | - 모든 서비스 정상→healthy<br>- DB 연결 실패→degraded/unhealthy<br>- Redis 연결 실패→degraded<br>- Prisma client mock 처리 |
| `unit/system/helpers.test.ts` | formatUptime, formatBytes | 낮음 | - `formatUptime`: 초→"Xd Xh Xm Xs" 변환<br>- `formatBytes`: 바이트→"X.X GB/MB/KB" 변환<br>- 경계값 (0, 음수, 매우 큰 수) |

---

### 2.12 Utils (유틸리티)

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `unit/utils/sanitizer.test.ts` | **유지** | 충분 |
| `security/utils/sanitizer.test.ts` | **유지** | 보안 관점 검증 충분 |
| `unit/utils/type-guards.test.ts` | **수정** | `isValidJSON`, `isJSONSerializable`, `isEmptyObject` 등 누락 가드 추가 |
| `unit/utils/ip-utils.test.ts` | **유지** | 충분 |
| `unit/utils/csv-export.test.ts` | **유지** | 충분 |
| `unit/utils/short-code-generator.test.ts` | **유지** | 충분 |
| `unit/utils/utils.test.ts` | **수정** | 범용 유틸 함수 중 미커버 항목 추가 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `unit/utils/api-helpers.test.ts` | API 헬퍼 함수 | 중간 | - 응답 파싱/변환<br>- 에러 응답 표준화<br>- 헤더 설정 |
| `unit/utils/formatters.test.ts` | 포맷터 함수 | 중간 | - 날짜 포맷팅<br>- 숫자 포맷팅 (천 단위, 소수점)<br>- 통화 포맷팅<br>- 문자열 포맷팅 (truncate, capitalize 등) |
| `unit/utils/client-utils.test.ts` | 클라이언트 유틸 | 낮음 | - 브라우저 환경 감지<br>- 로컬스토리지 래퍼<br>- 클립보드 유틸 |

---

### 2.13 Validators (검증)

#### 기존 테스트 (유지)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `security/validators/validation-constants.test.ts` | **유지** | 충분 |
| `security/validators/validators.test.ts` | **유지** | 충분 |

#### 신규 테스트: 없음

현재 password-validator.ts 단일 파일이며 보안 테스트로 충분히 커버됩니다.

---

## 3. 테스트 유형별 횡단 계획

> 섹션 2는 도메인(모듈)별 **Unit 테스트** 중심 계획입니다.
> 이 섹션은 나머지 6개 테스트 유형을 **횡단(cross-cutting)** 관점에서 정의합니다.

---

### 3.1 Integration 테스트 (모듈 간 통합)

> **목적**: 모듈 간 협업이 올바르게 동작하는지 검증. 외부 서비스는 mock하되, 내부 모듈 간 실제 연결을 테스트.
> **위치**: `__tests__/integration/`

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `integration/cache.integration.test.ts` | **수정** | 하이브리드 캐시 전환, TTL과 무효화 연동 시나리오 추가 |

#### 신규 테스트

| 파일 경로 | 통합 대상 | 우선순위 | 테스트 케이스 |
|----------|----------|---------|-------------|
| `integration/auth-repository.integration.test.ts` | Auth Repositories + Error 시스템 | 높음 | - UserRepository CRUD 전체 플로우 (Prisma mock 사용)<br>- OAuthRepository 계정 연결/해제 플로우<br>- EmailTokenRepository 생성→조회→사용→삭제 라이프사이클<br>- 중복 생성 시 AppError 변환 검증<br>- 만료 토큰 정리 후 조회 실패 검증 |
| `integration/auth-middleware-jwt.integration.test.ts` | Auth Middleware + JWT + Error Handler | 높음 | - JWT 발급→미들웨어 검증→요청 통과 전체 플로우<br>- JWT 만료→미들웨어 거부→에러 응답 형식 검증<br>- 블랙리스트 토큰→미들웨어 거부 플로우<br>- adminMiddleware: role 기반 접근 제어 전체 플로우 |
| `integration/middleware-chain.integration.test.ts` | 미들웨어 체인 조합 | 중간 | - CORS→Security→Auth 순서 실행 검증<br>- CORS preflight에서 이후 미들웨어 스킵<br>- Security 차단 시 Auth 미실행 확인<br>- Rate Limit 초과 시 에러 응답 + 헤더 검증<br>- 에러 핸들러가 모든 미들웨어 에러를 포착하는지 검증 |
| `integration/cache-geolocation.integration.test.ts` | Cache + Geolocation | 중간 | - GeoIP 조회 결과 캐시 저장/재조회<br>- 캐시 히트 시 프로바이더 API 호출 없음 확인<br>- 캐시 만료 후 프로바이더 재호출<br>- 프로바이더 실패 시 캐시 폴백 |
| `integration/storage-error.integration.test.ts` | Storage + Error + Logger | 중간 | - R2 업로드 실패→AppError 변환→로그 기록 검증<br>- 비활성 R2에서 graceful 에러 처리<br>- 대용량 파일 업로드 시 에러 핸들링 |
| `integration/error-recovery.integration.test.ts` | Error Recovery + Logger | 중간 | - CircuitBreaker 상태 전환→로그 기록 검증<br>- withRetry 실패→에러 로깅 플로우<br>- withFallbackChain 전체 체인 실행→최종 결과/에러 검증 |
| `integration/system-health.integration.test.ts` | System + Cache + Logger | 낮음 | - 헬스체크에서 캐시/DB 상태 통합 조회<br>- 시스템 정보 수집→로깅 플로우<br>- 서비스 장애 시 degraded 상태 보고 |

---

### 3.2 API 테스트 (패키지 공개 API 계약)

> **목적**: npm 패키지 소비자 관점에서 각 subpath export의 공개 API가 계약대로 동작하는지 검증.
> **핵심**: import 경로, export 심볼 존재 여부, 타입 호환성, 하위 호환성 보장.
> **위치**: `__tests__/api/`

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `api/exports-auth.test.ts` | `@withwiz/toolkit/auth` exports | 높음 | - `import { signToken, verifyToken } from './auth/core/jwt'` 존재 확인<br>- `import { hashPassword, comparePassword } from './auth/core/password'` 존재 확인<br>- `import { getOAuthUrl, handleOAuthCallback } from './auth/core/oauth'` 존재 확인<br>- 7개 subpath 전체 import 가능 검증<br>- 각 export가 function/class 타입인지 검증 |
| `api/exports-cache.test.ts` | `@withwiz/toolkit/cache` exports | 높음 | - CacheFactory, InMemoryCacheManager 등 핵심 클래스 export 확인<br>- 5개 subpath import 검증<br>- factory 패턴 API 시그니처 안정성 |
| `api/exports-error.test.ts` | `@withwiz/toolkit/error` exports | 높음 | - AppError 클래스, ErrorResponse 객체 export 확인<br>- static factory 메서드 시그니처 검증<br>- toJSON() 반환 구조 계약 검증 |
| `api/exports-middleware.test.ts` | `@withwiz/toolkit/middleware` exports | 높음 | - authMiddleware, corsMiddleware, securityMiddleware 등 export 확인<br>- 4개 subpath import 검증<br>- 미들웨어 함수 시그니처 (req, res, next) 검증 |
| `api/exports-components.test.ts` | `@withwiz/toolkit/components/ui/*` exports | 중간 | - Button, DataTable, Badge 등 12개 컴포넌트 export 확인<br>- React.FC 또는 forwardRef 타입 검증 |
| `api/exports-utils.test.ts` | `@withwiz/toolkit/utils` exports | 중간 | - 15+ subpath import 검증<br>- 각 유틸 함수 export 존재 확인 |
| `api/exports-hooks.test.ts` | `@withwiz/toolkit/hooks/*` exports | 중간 | - useDataTable, useDebounce, useExitIntent, useTimezone export 확인<br>- 훅 함수 시그니처 검증 |
| `api/exports-types.test.ts` | `@withwiz/toolkit/types/*` exports | 중간 | - 7개 type subpath import 가능 검증<br>- 주요 타입/인터페이스 존재 확인 |
| `api/exports-constants.test.ts` | `@withwiz/toolkit/constants` exports | 낮음 | - ERROR_CODES, PAGINATION, SECURITY_HEADERS 등 상수 export 확인<br>- 4개 subpath import 검증 |
| `api/exports-system.test.ts` | `@withwiz/toolkit/system` exports | 낮음 | - getSystemInfo, checkServiceHealth 등 export 확인<br>- 반환 타입 구조 검증 |
| `api/exports-storage.test.ts` | `@withwiz/toolkit/storage` exports | 낮음 | - uploadToR2, getFromR2, deleteFromR2 등 export 확인 |
| `api/exports-validators.test.ts` | `@withwiz/toolkit/validators` exports | 낮음 | - validatePassword export 확인<br>- 반환 타입 { isValid, errors } 구조 검증 |
| `api/backward-compatibility.test.ts` | 하위 호환성 | 높음 | - v0.1.x에서 사용되던 주요 import 경로가 v0.2.0에서도 동작 확인<br>- deprecated export가 있다면 경고 메시지 검증<br>- 타입 변경 없이 동일 시그니처 유지 확인 |

---

### 3.3 E2E 테스트 (소비자 관점 전체 플로우)

> **목적**: 실제 소비자(Next.js 앱)가 패키지를 사용하는 시나리오를 시뮬레이션.
> **환경**: Next.js mock 환경, 외부 서비스(Redis, S3, DB)는 mock/stub.
> **위치**: `__tests__/e2e/`

#### 신규 테스트

| 파일 경로 | 시나리오 | 우선순위 | 테스트 케이스 |
|----------|---------|---------|-------------|
| `e2e/auth-flow.e2e.test.ts` | 인증 전체 플로우 | 높음 | - **회원가입 → 로그인 → 토큰 발급 → API 보호 → 로그아웃**<br>  1. 비밀번호 해싱으로 사용자 생성<br>  2. 이메일/비밀번호 검증 → JWT 발급<br>  3. JWT로 authMiddleware 통과<br>  4. 토큰 만료 → refreshToken으로 재발급<br>  5. 로그아웃 → 토큰 블랙리스트 등록<br>  6. 블랙리스트 토큰으로 접근 시 401 |
| `e2e/oauth-flow.e2e.test.ts` | OAuth 전체 플로우 | 높음 | - **OAuth URL 생성 → 콜백 처리 → 계정 연결 → 로그인**<br>  1. getOAuthUrl로 provider URL 생성 (state 포함)<br>  2. 콜백으로 authorization code 수신 (mock)<br>  3. 토큰 교환 → 사용자 프로필 조회<br>  4. 기존 사용자 연결 / 신규 사용자 생성<br>  5. JWT 발급 → 로그인 완료 |
| `e2e/api-error-handling.e2e.test.ts` | 에러 처리 전체 플로우 | 높음 | - **요청 → 에러 발생 → 에러 변환 → 표준 응답 → 로깅**<br>  1. 잘못된 입력 → 422 Validation Error 응답<br>  2. 미인증 요청 → 401 Unauthorized 응답<br>  3. 권한 부족 → 403 Forbidden 응답<br>  4. 리소스 미존재 → 404 Not Found 응답<br>  5. 서버 에러 → 500 Internal Error 응답 (상세 숨김)<br>  6. 각 에러에서 requestId 포함, locale별 메시지 반환 |
| `e2e/middleware-pipeline.e2e.test.ts` | 미들웨어 파이프라인 | 중간 | - **요청 → CORS → Security → Rate Limit → Auth → Handler → Response**<br>  1. 정상 요청: 전체 파이프라인 통과<br>  2. CORS 위반: 초기 차단, 이후 미실행<br>  3. 보안 위반 (TRACE): 보안 레이어에서 차단<br>  4. Rate Limit 초과: 429 응답 + Retry-After 헤더<br>  5. 인증 실패: 401 응답, 핸들러 미실행 |
| `e2e/cache-strategy.e2e.test.ts` | 캐싱 전략 전체 플로우 | 중간 | - **데이터 조회 → 캐시 저장 → 캐시 히트 → 무효화 → 재조회**<br>  1. 첫 요청: DB 조회 → 캐시 저장<br>  2. 두 번째 요청: 캐시 히트 (DB 미조회)<br>  3. 데이터 변경: 캐시 무효화<br>  4. 세 번째 요청: DB 재조회 → 새 캐시 저장<br>  5. TTL 만료: 자동 캐시 제거 → DB 재조회 |
| `e2e/file-upload.e2e.test.ts` | 파일 업로드 전체 플로우 | 중간 | - **업로드 → 저장 → 조회 → 삭제**<br>  1. 파일 업로드 → R2 저장 (key 반환)<br>  2. key로 파일 조회 → 원본 content-type 확인<br>  3. 파일 삭제 → key 무효화<br>  4. 삭제된 파일 조회 → 에러 응답 |
| `e2e/system-monitoring.e2e.test.ts` | 시스템 모니터링 전체 플로우 | 낮음 | - **헬스체크 → 시스템 정보 → 환경 검증**<br>  1. 정상 상태: healthy + 전체 시스템 메트릭<br>  2. DB 장애: degraded + 상세 에러 정보<br>  3. 환경변수 누락: 경고 목록 반환 |
| `e2e/geolocation-lookup.e2e.test.ts` | 지오로케이션 전체 플로우 | 낮음 | - **IP 조회 → 캐시 → 배치 처리 → 프로바이더 전환**<br>  1. 단일 IP 조회 → 위치 정보 반환<br>  2. 동일 IP 재조회 → 캐시 히트<br>  3. 대량 IP 배치 처리 → 진행률/결과<br>  4. 프로바이더 장애 → 자동 전환 |

---

### 3.4 Security 테스트 (보안)

> **목적**: 인증, 입력 검증, 미들웨어, 스토리지 등의 보안 취약점 검증.
> **위치**: `__tests__/security/`

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `security/auth/auth-jwt.test.ts` | **수정** | 토큰 위조/재사용 공격 시나리오 추가 |
| `security/auth/oauth.test.ts` | **수정** | CSRF state 검증, redirect_uri 변조 테스트 추가 |
| `security/auth/oauth-prompt-parameter.test.ts` | **유지** | 충분 |
| `security/auth/password.test.ts` | **유지** | 충분 |
| `security/utils/sanitizer.test.ts` | **유지** | 충분 |
| `security/validators/validation-constants.test.ts` | **유지** | 충분 |
| `security/validators/validators.test.ts` | **유지** | 충분 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `security/middleware/cors-security.test.ts` | CORS 보안 | 높음 | - Origin 스푸핑 시도 차단<br>- 와일드카드(*) origin 프로덕션 금지<br>- credential 요청 시 strict origin 검증<br>- 허용되지 않은 메서드/헤더 차단 |
| `security/middleware/security-headers.test.ts` | 보안 헤더 | 높음 | - X-Frame-Options: DENY/SAMEORIGIN 설정 검증<br>- Content-Security-Policy 지시어 검증<br>- X-Content-Type-Options: nosniff 확인<br>- Strict-Transport-Security (HSTS) 확인<br>- X-XSS-Protection 헤더 확인<br>- Referrer-Policy 설정 확인 |
| `security/middleware/rate-limit-security.test.ts` | Rate Limit 보안 | 중간 | - IP 기반 제한 동작 (순간 폭주 차단)<br>- 429 응답 후 Retry-After 헤더<br>- 분산 공격 감지 (동일 패턴) |
| `security/auth/token-security.test.ts` | 토큰 보안 | 높음 | - 만료 토큰 재사용 거부<br>- 변조 토큰 (payload 수정) 거부<br>- 서명 불일치 (다른 secret) 거부<br>- 알고리즘 혼동 공격 (none, HS256→RS256) 방어<br>- 블랙리스트 토큰 거부<br>- refresh token으로 access token 역할 불가 |
| `security/storage/r2-security.test.ts` | 스토리지 보안 | 중간 | - 경로 순회 공격 (../../etc/passwd) 차단<br>- 허용되지 않은 파일 확장자 차단<br>- 파일 크기 제한 초과 거부<br>- 인증 없는 접근 차단 |
| `security/error/error-info-leak.test.ts` | 에러 정보 노출 | 높음 | - 프로덕션 모드에서 스택 트레이스 숨김<br>- 500 에러 시 내부 구현 세부사항 비노출<br>- 에러 메시지에 민감 정보(DB 쿼리, 비밀번호 등) 비포함<br>- requestId는 포함하되 서버 내부 경로 비노출 |
| `security/input/injection-prevention.test.ts` | 인젝션 방지 통합 | 중간 | - SQL Injection 패턴 차단 (sanitizer + validator 연동)<br>- XSS 페이로드 차단 (script 태그, event handler)<br>- NoSQL Injection ($gt, $regex 등) 차단<br>- Command Injection 패턴 차단<br>- Path Traversal 패턴 차단 |

---

### 3.5 Performance 테스트 (성능)

> **목적**: 응답 시간, 메모리 사용량, 처리량 등의 성능 기준 검증.
> **위치**: `__tests__/performance/`

#### 기존 테스트 (유지)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `performance/cache/cache-advanced.test.ts` | **유지** | 충분 |
| `performance/cache/cache-limit-lru.test.ts` | **유지** | 충분 |
| `performance/cache/cache-managers.test.ts` | **유지** | 충분 |
| `performance/cache/redis-delete-pattern-scan.test.ts` | **유지** | 충분 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `performance/middleware/middleware-overhead.test.ts` | 미들웨어 성능 | 중간 | - 단일 미들웨어 오버헤드 (<5ms)<br>- 미들웨어 체인(5개) 전체 오버헤드 (<20ms)<br>- 1000 요청 연속 처리 시 메모리 누수 없음<br>- Rate Limit 체크 성능 (<1ms per check) |
| `performance/auth/jwt-performance.test.ts` | JWT 성능 | 중간 | - JWT 서명 성능 (1000회 < 1초)<br>- JWT 검증 성능 (1000회 < 500ms)<br>- 대량 토큰 블랙리스트 조회 성능 |
| `performance/geolocation/batch-performance.test.ts` | 배치 처리 성능 | 낮음 | - 100건 순차 처리 시간 측정<br>- 100건 병렬 처리 시간 측정 (순차 대비 개선율)<br>- 메모리 사용량이 배치 크기에 비례하지 않음 확인 |
| `performance/utils/sanitizer-performance.test.ts` | Sanitizer 성능 | 낮음 | - 대용량 문자열(10KB) 처리 성능<br>- 1000건 연속 처리 시 일관된 성능<br>- 중첩된 악성 패턴 처리 성능 (ReDoS 방지) |
| `performance/error/error-creation-performance.test.ts` | 에러 생성 성능 | 낮음 | - AppError 10000건 생성 성능<br>- toJSON() 직렬화 성능<br>- processError() 변환 성능 |

---

### 3.6 Accessibility 테스트 (접근성)

> **목적**: UI 컴포넌트가 WCAG 2.1 AA 기준을 충족하는지 검증.
> **위치**: `__tests__/accessibility/`

#### 기존 테스트 (유지/수정)

| 파일 | 액션 | 상세 |
|-----|------|-----|
| `accessibility/components/client-utils.test.ts` | **수정** | 개별 컴포넌트 접근성 테스트로 분리 |
| `accessibility/hooks/hooks.test.tsx` | **수정** | 훅 사용 시 접근성 영향 검증 추가 |

#### 신규 테스트

| 파일 경로 | 테스트 대상 | 우선순위 | 테스트 케이스 |
|----------|-----------|---------|-------------|
| `accessibility/components/button-a11y.test.tsx` | Button 접근성 | 높음 | - `role="button"` 존재 확인<br>- 키보드 접근성: Enter/Space로 클릭 가능<br>- `aria-disabled` 상태 (disabled 시)<br>- 포커스 인디케이터 존재 (focus-visible)<br>- 충분한 색상 대비 (variant별)<br>- screen reader 라벨 제공 |
| `accessibility/components/data-table-a11y.test.tsx` | DataTable 접근성 | 높음 | - `role="table"`, `role="row"`, `role="cell"` 구조<br>- 정렬 가능 컬럼에 `aria-sort` 속성<br>- 체크박스에 `aria-label` 제공<br>- 페이지네이션 `aria-label` + `aria-current`<br>- 빈 상태에 `role="status"` 또는 `aria-live`<br>- 키보드로 행 탐색 가능 |
| `accessibility/components/alert-a11y.test.tsx` | Alert 접근성 | 중간 | - `role="alert"` 또는 `role="status"` 존재<br>- `aria-live="polite"` 또는 `"assertive"` 설정<br>- 닫기 버튼에 `aria-label` 제공 |
| `accessibility/components/select-a11y.test.tsx` | Select 접근성 | 중간 | - 키보드 탐색 (ArrowUp/Down)<br>- `aria-expanded`, `aria-selected` 상태 관리<br>- `role="listbox"` + `role="option"` 구조<br>- screen reader에서 선택 항목 안내 |
| `accessibility/components/input-a11y.test.tsx` | Input 접근성 | 중간 | - `label` 연결 (htmlFor + id)<br>- 에러 상태에서 `aria-invalid="true"`<br>- 에러 메시지 `aria-describedby` 연결<br>- `aria-required` (필수 입력) |
| `accessibility/components/error-components-a11y.test.tsx` | 에러 컴포넌트 접근성 | 중간 | - `ErrorPage`: 에러 메시지 `role="alert"`<br>- `ErrorAlert`: `aria-live` 영역<br>- `LoadingState`: `aria-busy="true"`, `role="status"`<br>- `EmptyState`: `role="status"` 상태 안내 |

---

### 3.7 테스트 유형별 요약 매트릭스

| 도메인 | Unit | Integration | API | E2E | Security | Performance | Accessibility |
|-------|------|-------------|-----|-----|----------|-------------|---------------|
| **Auth** | ✅ 5신규 | ✅ 2신규 | ✅ 1신규 | ✅ 2신규 | ✅ 2수정+1신규 | ✅ 1신규 | - |
| **Cache** | ✅ 3신규 | ✅ 1수정+1신규 | ✅ 1신규 | ✅ 1신규 | - | ✅ 4기존 | - |
| **Components** | ✅ 7신규 | - | ✅ 1신규 | - | - | - | ✅ 1수정+5신규 |
| **Constants** | ✅ 3신규 | - | ✅ 1신규 | - | - | - | - |
| **Error** | ✅ 7신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 |
| **Geolocation** | ✅ 3신규 | ✅ 1신규 | - | ✅ 1신규 | - | ✅ 1신규 | - |
| **Hooks** | ✅ 4신규 | - | ✅ 1신규 | - | - | - | ✅ 1수정 |
| **Logger** | ✅ 기존 | - | - | - | - | - | - |
| **Middleware** | ✅ 4신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | ✅ 3신규 | ✅ 1신규 | - |
| **Storage** | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | - | - |
| **System** | ✅ 8신규 | ✅ 1신규 | ✅ 1신규 | ✅ 1신규 | - | - | - |
| **Utils** | ✅ 3신규 | - | ✅ 1신규 | - | ✅ 1신규 | ✅ 1신규 | - |
| **Validators** | ✅ 기존 | - | ✅ 1신규 | - | ✅ 기존 | - | - |
| **횡단** | - | - | ✅ 1신규 | - | - | - | - |

---

## 4. 우선순위 및 실행 계획

> Phase 1~4는 섹션 2의 Unit 테스트 + 섹션 3의 횡단 테스트를 통합한 실행 계획입니다.

### Phase 1: 핵심 인프라 (높음 우선순위)

> 미테스트 모듈 중 프로덕션 영향도가 가장 큰 영역

| # | 테스트 파일 | 대상 모듈 | 예상 테스트 수 |
|---|-----------|----------|-------------|
| 1 | `unit/middleware/auth-middleware.test.ts` | 인증 미들웨어 | ~12 |
| 2 | `unit/middleware/cors-middleware.test.ts` | CORS 미들웨어 | ~8 |
| 3 | `unit/middleware/security-middleware.test.ts` | 보안 미들웨어 | ~8 |
| 4 | `unit/storage/r2-storage.test.ts` | R2 스토리지 | ~10 |
| 5 | `unit/system/health-check.test.ts` | 헬스체크 | ~8 |
| 6 | `unit/error/error-handler.test.ts` | 에러 핸들러 | ~12 |

### Phase 2: 비즈니스 로직 (높음~중간 우선순위)

> 데이터 접근 및 핵심 기능

| # | 테스트 파일 | 대상 모듈 | 예상 테스트 수 |
|---|-----------|----------|-------------|
| 7 | `unit/auth/prisma-user-repository.test.ts` | 사용자 저장소 | ~10 |
| 8 | `unit/auth/prisma-oauth-repository.test.ts` | OAuth 저장소 | ~8 |
| 9 | `unit/cache/cache-factory.test.ts` | 캐시 팩토리 | ~8 |
| 10 | `unit/constants/error-codes.test.ts` | 에러 코드 유틸 | ~12 |
| 11 | `unit/error/circuit-breaker.test.ts` | 서킷 브레이커 | ~8 |
| 12 | `unit/error/retry.test.ts` | 재시도 로직 | ~8 |
| 13 | `unit/geolocation/provider-factory.test.ts` | 프로바이더 팩토리 | ~8 |

### Phase 3: UI 및 사용자 인터페이스 (중간 우선순위)

> 컴포넌트 및 훅

| # | 테스트 파일 | 대상 모듈 | 예상 테스트 수 |
|---|-----------|----------|-------------|
| 14 | `unit/components/button.test.tsx` | Button | ~8 |
| 15 | `unit/components/data-table.test.tsx` | DataTable | ~15 |
| 16 | `unit/components/badge.test.tsx` | Badge | ~5 |
| 17 | `unit/hooks/use-data-table.test.ts` | useDataTable | ~12 |
| 18 | `unit/hooks/use-debounce.test.ts` | useDebounce | ~6 |
| 19 | `unit/error/error-components.test.tsx` | 에러 컴포넌트 | ~10 |

### Phase 4: 보완 (낮은 우선순위)

> 나머지 모듈 및 엣지 케이스

| # | 테스트 파일 | 대상 모듈 | 예상 테스트 수 |
|---|-----------|----------|-------------|
| 20 | `unit/system/cpu.test.ts` | CPU 모니터링 | ~5 |
| 21 | `unit/system/memory.test.ts` | 메모리 모니터링 | ~5 |
| 22 | `unit/system/disk.test.ts` | 디스크 모니터링 | ~5 |
| 23 | `unit/system/environment.test.ts` | 환경변수 체크 | ~6 |
| 24 | `unit/geolocation/providers.test.ts` | GeoIP 프로바이더 | ~12 |
| 25 | `unit/middleware/error-handler-middleware.test.ts` | 에러 미들웨어 | ~6 |
| 26 | `unit/error/error-logging.test.ts` | 에러 로깅 | ~8 |
| 27 | `unit/error/fallback.test.ts` | 폴백 체인 | ~8 |
| 28 | `unit/utils/formatters.test.ts` | 포맷터 | ~10 |
| 29 | `unit/constants/security.test.ts` | 보안 상수 | ~6 |
| 30 | `unit/system/helpers.test.ts` | 시스템 헬퍼 | ~6 |

### 기존 테스트 수정 목록

| # | 파일 | 수정 내용 |
|---|-----|---------|
| M1 | `security/auth/auth-jwt.test.ts` | 토큰 만료/리프레시 시나리오 추가 |
| M2 | `unit/error/app-error.test.ts` | static factory 메서드 테스트 추가 |
| M3 | `unit/error/error-recovery.test.ts` | FeatureDegradation 테스트 추가 |
| M4 | `unit/utils/type-guards.test.ts` | 누락된 타입 가드 함수 테스트 추가 |
| M5 | `unit/utils/utils.test.ts` | 미커버 유틸 함수 추가 |
| M6 | `integration/cache.integration.test.ts` | 하이브리드 캐시 전환 시나리오 추가 |
| M7 | `accessibility/hooks/hooks.test.tsx` | 기능 테스트 보강 |

### 삭제 대상

| # | 파일 | 사유 |
|---|-----|-----|
| D1 | `unit/error/error-codes.test.ts` | `unit/constants/error-codes.test.ts`로 이동 (중복 제거) |

---

### 총 예상 테스트 수

| 테스트 유형 | 기존 (유지) | 기존 (수정) | 신규 | 소계 파일 수 |
|-----------|-----------|-----------|------|-----------|
| **Unit** | 11 | 4 (M2~M5) | 30 | 45 |
| **Integration** | 0 | 1 (M6) | 7 | 8 |
| **API** | 0 | 0 | 13 | 13 |
| **E2E** | 0 | 0 | 8 | 8 |
| **Security** | 5 | 2 (M1+oauth) | 7 | 14 |
| **Performance** | 4 | 0 | 5 | 9 |
| **Accessibility** | 0 | 2 (M7+client) | 6 | 8 |
| **합계** | **20** | **9** | **76** | **105** |

| 구분 | 파일 수 | 예상 테스트 케이스 수 |
|-----|--------|-------------------|
| 신규 | 76 | ~550 |
| 수정 | 9 | ~60 추가 |
| 삭제 | 1 | - |
| **최종 합계** | **84 (net)** | **~610** |

### 실행 원칙

1. **TDD 방식**: 테스트 먼저 작성 → 실패 확인 → 구현 확인 → 리팩터링
2. **모킹 전략**: 외부 의존성(Redis, S3, Prisma, fetch)은 `vi.mock()`으로 격리
3. **AAA 패턴**: Arrange-Act-Assert 구조 준수
4. **네이밍**: `should [동작] when [조건]` 형식
5. **커버리지**: 각 Phase 완료 시 `npm run test:coverage`로 진행률 확인
6. **npm scripts 추가**: `test:api`, `test:e2e` 스크립트를 package.json에 등록
