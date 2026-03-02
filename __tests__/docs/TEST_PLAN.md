# @withwiz 테스트 계획

## 개요

`packages/@withwiz/toolkit` 모듈은 URL Shortener 프로젝트와 독립적인 범용 유틸리티입니다.
이 모듈들은 다른 프로젝트에서도 재사용 가능해야 하므로, 프로젝트 특정 의존성 없이 독립적으로 테스트되어야 합니다.

## 테스트 전략

### 1. 격리 원칙

- **NO URL Shortener 의존성**: 테스트는 `src/lib/`, `src/app/`, `src/components/`를 import하지 않음
- **NO Prisma 의존성**: 실제 DB 연결 없이 모킹으로 테스트
- **독립 실행**: `cd packages/@withwiz/toolkit && npx jest`로 독립 실행 가능

### 2. 테스트 레벨

| 레벨 | 목적 | 예시 |
|------|------|------|
| **Unit** | 개별 함수/클래스 단위 테스트 | `url-normalizer.test.ts` |
| **Integration** | 여러 모듈 간 통합 테스트 | `cache.integration.test.ts` |
| **Contract** | 인터페이스/타입 계약 검증 | Provider 인터페이스 구현 검증 |

### 3. 커버리지 목표

- **라인 커버리지**: 80% 이상
- **브랜치 커버리지**: 75% 이상
- **함수 커버리지**: 85% 이상

## 모듈별 테스트 시나리오

### 1. Utils 모듈

#### 1.1 URL Normalizer
- ✅ **기존**: 기본 정규화 테스트
- 🆕 **추가 필요**:
  - Edge cases (빈 문자열, null, undefined)
  - 다양한 프로토콜 (http, https, ftp, ws)
  - 쿼리 파라미터 정렬 검증
  - Fragment 처리 검증
  - 국제화 도메인 (IDN) 처리

#### 1.2 IP Utils
- 🆕 **추가 필요**:
  - IPv4/IPv6 검증
  - IP 정규화 (::1 → 0:0:0:0:0:0:0:1)
  - Private IP 판별 (10.x.x.x, 192.168.x.x)
  - Localhost 판별
  - Cloudflare/Proxy IP 헤더 파싱

#### 1.3 Timezone Utils
- 🆕 **추가 필요**:
  - Timezone 감지
  - UTC offset 계산
  - DST (Daylight Saving Time) 처리
  - 타임존 변환 정확성

#### 1.4 Short Code Generator
- 🆕 **추가 필요**:
  - 생성된 코드 길이 검증
  - 고유성 검증 (충돌 확률 < 0.01%)
  - 금지 문자 없음 검증
  - 성능 테스트 (10,000회 생성 < 1초)

#### 1.5 Sanitizer
- 🆕 **추가 필요**:
  - XSS 방어 (스크립트 태그 제거)
  - SQL Injection 방어 (특수문자 이스케이핑)
  - HTML 엔티티 인코딩
  - 재귀적 sanitization 방어

#### 1.6 CSV Export
- ✅ **기존**: 기본 CSV 생성 테스트
- 🆕 **추가 필요**:
  - CSV Injection 방어 (=, +, -, @ 접두사)
  - 다국어 문자 인코딩 (UTF-8 BOM)
  - 큰 데이터셋 처리 (메모리 효율성)

#### 1.7 Format Number
- 🆕 **추가 필요**:
  - 다국어 숫자 포맷 (ko, en, ja)
  - 천 단위 구분자
  - 소수점 자리수 제어
  - 음수 처리

### 2. Auth 모듈

#### 2.1 JWT
- ✅ **기존**: 토큰 생성/검증 기본 테스트
- 🆕 **추가 필요**:
  - 만료 토큰 거부
  - 잘못된 서명 거부
  - Payload 변조 감지
  - 알고리즘 혼동 공격 방어 (RS256 ↔ HS256)
  - Refresh Token 흐름

#### 2.2 Password
- 🆕 **추가 필요**:
  - 비밀번호 해싱 (bcrypt)
  - Salt 랜덤성 검증
  - 해시 비교 타이밍 공격 방어
  - 비밀번호 강도 검증
  - 역사적 비밀번호 재사용 방지

#### 2.3 OAuth
- 🆕 **추가 필요**:
  - Authorization Code 흐름
  - State 파라미터 검증 (CSRF 방어)
  - PKCE 지원
  - Provider별 프로필 파싱 (Google, GitHub)

### 3. Cache 모듈

#### 3.1 Redis Cache Manager
- ✅ **기존**: 통합 테스트 존재
- 🆕 **추가 필요**:
  - 연결 실패 처리
  - TTL 정확성 검증
  - 키 만료 이벤트 처리
  - Pipeline/Transaction 지원
  - Pub/Sub 기능

#### 3.2 InMemory Cache Manager
- 🆕 **추가 필요**:
  - LRU 정책 검증
  - 메모리 제한 준수
  - TTL 자동 만료
  - 동시성 안전성 (race condition)

#### 3.3 Hybrid Cache Manager
- 🆕 **추가 필요**:
  - L1(메모리) → L2(Redis) fallback
  - Write-through vs Write-behind
  - Invalidation 전파
  - Cache stampede 방어

#### 3.4 Noop Cache Manager
- 🆕 **추가 필요**:
  - 모든 작업이 no-op 확인
  - 성능 오버헤드 최소화

### 4. Error 모듈

#### 4.1 AppError
- ✅ **기존**: 기본 에러 생성 테스트
- 🆕 **추가 필요**:
  - 에러 체이닝 (cause)
  - Stack trace 보존
  - 에러 직렬화 (toJSON)
  - 다국어 메시지 지원

#### 4.2 Error Logger
- 🆕 **추가 필요**:
  - Transport별 로깅 (Console, File, Sentry, Slack)
  - 로그 레벨 필터링
  - PII 마스킹 (개인정보 제거)
  - 구조화된 로그 (JSON)

#### 4.3 Circuit Breaker
- 🆕 **추가 필요**:
  - Open → Half-Open → Closed 상태 전환
  - 실패율 임계값 검증
  - 타임아웃 설정
  - Fallback 함수 실행

#### 4.4 Retry Logic
- 🆕 **추가 필요**:
  - 지수 백오프 (Exponential Backoff)
  - 최대 재시도 횟수
  - Jitter 추가 (충돌 방지)
  - Idempotency 검증

### 5. Validators 모듈

#### 5.1 Password Validator
- ✅ **기존**: 기본 검증 테스트
- 🆕 **추가 필요**:
  - 최소/최대 길이
  - 대소문자, 숫자, 특수문자 조합
  - Common password 거부 (123456, password)
  - 개인정보 포함 검증 (이름, 이메일)

#### 5.2 Validation Constants
- ✅ **기존**: 상수 값 테스트
- 🆕 **추가 필요**:
  - URL 패턴 정규식 검증
  - 이메일 패턴 정규식 검증
  - 타입 안전성 검증

### 6. Constants 모듈

#### 6.1 Error Codes
- ✅ **기존**: 기본 테스트
- 🆕 **추가 필요**:
  - 중복 코드 없음 검증
  - HTTP 상태 코드 매핑 정확성
  - I18n 메시지 키 존재 검증

#### 6.2 Validation Constants
- ✅ **기존**: 기본 테스트
- 🆕 **추가 필요**:
  - 값 범위 검증
  - 타입 불변성 검증

### 7. Geolocation 모듈

#### 7.1 Provider Interface
- 🆕 **추가 필요**:
  - Contract 테스트 (모든 Provider가 동일 인터페이스 구현)
  - Fallback chain 검증
  - Rate limit 처리
  - 타임아웃 처리

#### 7.2 IP-API Provider
- 🆕 **추가 필요**:
  - API 응답 파싱
  - 에러 응답 처리 (429, 500)
  - Mock 서버로 테스트

#### 7.3 MaxMind Provider
- 🆕 **추가 필요**:
  - Local DB 조회
  - 정확도 검증
  - 데이터 업데이트 감지

#### 7.4 Batch Processor
- 🆕 **추가 필요**:
  - 대량 IP 처리 (1000개+)
  - 병렬 처리 성능
  - 부분 실패 처리
  - 진행률 추적

### 8. Logger 모듈

- 🆕 **추가 필요**:
  - 로그 레벨별 출력 (debug, info, warn, error)
  - 구조화된 로그 (JSON)
  - Context 전파 (requestId, userId)
  - 성능 영향 최소화 (비동기 로깅)

### 9. System 모듈

#### 9.1 CPU Metrics
- 🆕 **추가 필요**:
  - CPU 사용률 측정
  - 코어별 사용률
  - Load average

#### 9.2 Memory Metrics
- 🆕 **추가 필요**:
  - 메모리 사용량 (heap, RSS)
  - 메모리 누수 감지
  - GC 통계

#### 9.3 Disk Metrics
- 🆕 **추가 필요**:
  - 디스크 사용량
  - I/O 통계
  - 여유 공간 검증

#### 9.4 Network Metrics
- 🆕 **추가 필요**:
  - 네트워크 트래픽
  - 연결 수
  - 대역폭 사용량

### 10. Hooks 모듈

#### 10.1 useDebounce
- 🆕 **추가 필요**:
  - Debounce 지연 검증
  - 빠른 입력 시 중간 값 무시
  - 마지막 값만 전달
  - Cleanup 검증

#### 10.2 useTimezone
- 🆕 **추가 필요**:
  - 브라우저 타임존 감지
  - 타임존 변경 감지
  - SSR 호환성

#### 10.3 useExitIntent
- 🆕 **추가 필요**:
  - 마우스 커서가 상단을 벗어날 때 감지
  - 모바일 대응 (터치 이벤트)
  - 중복 트리거 방지

#### 10.4 useDataTable
- 🆕 **추가 필요**:
  - 정렬 상태 관리
  - 필터링 상태 관리
  - 페이지네이션 상태 관리
  - 다중 정렬

## 테스트 실행 방법

### 독립 실행
```bash
cd packages/@withwiz/toolkit
npx jest
```

### 커버리지 리포트
```bash
cd packages/@withwiz/toolkit
npx jest --coverage
```

### Watch 모드
```bash
cd packages/@withwiz/toolkit
npx jest --watch
```

### 특정 파일만
```bash
cd packages/@withwiz/toolkit
npx jest __tests__/unit/utils.test.ts
```

## 테스트 작성 가이드라인

### 1. 파일 명명 규칙
- 단위 테스트: `__tests__/unit/{모듈명}.test.ts`
- 통합 테스트: `__tests__/integration/{모듈명}.integration.test.ts`

### 2. 테스트 구조
```typescript
describe('모듈명', () => {
  describe('함수명', () => {
    it('should 기대 동작', () => {
      // Arrange
      const input = ...;

      // Act
      const result = func(input);

      // Assert
      expect(result).toBe(...);
    });
  });
});
```

### 3. 모킹 원칙
- **외부 의존성만 모킹**: DB, API, 파일 시스템
- **내부 함수는 실제 호출**: 실제 동작 검증
- **Mock 재사용**: `__tests__/mocks/` 디렉토리

### 4. Edge Case 필수
- 빈 값 (null, undefined, '', [])
- 경계 값 (0, -1, MAX_INT)
- 잘못된 타입
- 비정상 입력

## CI/CD 통합

### GitHub Actions
```yaml
- name: Test @withwiz
  run: |
    cd packages/@withwiz/toolkit
    npx jest --coverage --ci
  env:
    NODE_ENV: test
```

### 커버리지 임계값
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    lines: 80,
    branches: 75,
    functions: 85,
    statements: 80
  }
}
```

## 다음 단계

1. ✅ 테스트 계획 수립
2. 🔄 누락된 테스트 작성 (진행 중)
3. ⏳ 커버리지 80% 달성
4. ⏳ CI/CD 통합
5. ⏳ 성능 벤치마크 추가
