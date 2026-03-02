# @withwiz 테스트 시나리오

## 개요

`packages/@withwiz/toolkit`는 프로젝트 독립적인 범용 유틸리티 모듈입니다.
이 문서는 각 모듈별 테스트 시나리오와 테스트 케이스를 정의합니다.

---

## 테스트 완료 현황

✅ **완료**: 테스트 코드 작성 완료
🔄 **진행중**: 작성 중
⏳ **대기**: 작성 예정

## 테스트 구조

```
packages/@withwiz/toolkit/__tests__/
├── docs/
│   ├── TEST_PLAN.md          # 전체 테스트 계획
│   └── TEST_SCENARIOS.md     # 이 문서 (상세 시나리오)
├── unit/
│   ├── ip-utils.test.ts      # ✅ IP 유틸리티 (신규)
│   ├── sanitizer.test.ts     # ✅ Sanitizer (신규)
│   ├── short-code-generator.test.ts # ✅ Short Code Generator (신규)
│   ├── password.test.ts      # ✅ 비밀번호 모듈 (신규)
│   ├── utils.test.ts         # ✅ 기타 유틸리티
│   ├── validators.test.ts    # ✅ 비밀번호 검증기
│   ├── type-guards.test.ts   # ✅ 타입 가드
│   ├── csv-export.test.ts    # ✅ CSV 내보내기
│   ├── auth-jwt.test.ts      # ✅ JWT 토큰
│   ├── app-error.test.ts     # ✅ AppError
│   ├── error-codes.test.ts   # ✅ 에러 코드
│   └── validation-constants.test.ts # ✅ 검증 상수
├── integration/
│   └── cache.integration.test.ts # ✅ 캐시 통합 테스트
├── jest.config.js
└── setup.ts
```

---

## 1. auth 모듈

### 1.1 JWT (auth/core/jwt)

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-AUTH-JWT-001 | JWT 토큰 생성 | Access/Refresh 토큰 생성 |
| SC-AUTH-JWT-002 | JWT 토큰 검증 | 유효한/무효한 토큰 검증 |
| SC-AUTH-JWT-003 | 토큰 만료 처리 | 만료된 토큰 검증 |
| SC-AUTH-JWT-004 | 토큰 헤더 추출 | Authorization 헤더에서 토큰 추출 |

#### TC-AUTH-JWT-001: Access 토큰 생성
- **입력**: 사용자 정보 (userId, email, role)
- **기대 결과**: JWT 형식 문자열 반환
- **검증**: 토큰 디코딩 후 페이로드 확인

#### TC-AUTH-JWT-002: Refresh 토큰 생성
- **입력**: userId
- **기대 결과**: JWT 형식 문자열 반환
- **검증**: tokenType이 'refresh'인지 확인

#### TC-AUTH-JWT-003: 토큰 쌍 생성
- **입력**: 사용자 정보
- **기대 결과**: { accessToken, refreshToken } 객체

#### TC-AUTH-JWT-004: 유효한 Access 토큰 검증
- **입력**: 유효한 Access 토큰
- **기대 결과**: 페이로드 객체 반환

#### TC-AUTH-JWT-005: 만료된 토큰 검증
- **입력**: 만료된 토큰
- **기대 결과**: JWTError (TOKEN_EXPIRED)

#### TC-AUTH-JWT-006: 잘못된 서명 토큰 검증
- **입력**: 다른 secret으로 서명된 토큰
- **기대 결과**: JWTError (TOKEN_VERIFICATION_FAILED)

#### TC-AUTH-JWT-007: Authorization 헤더 추출 - Bearer
- **입력**: "Bearer eyJhbGciOiJIUzI1NiIs..."
- **기대 결과**: 토큰 문자열

#### TC-AUTH-JWT-008: Authorization 헤더 추출 - 잘못된 형식
- **입력**: "Basic xxx" 또는 null
- **기대 결과**: null

#### TC-AUTH-JWT-009: 토큰 만료 시간 확인
- **입력**: 토큰 페이로드
- **기대 결과**: 남은 시간 (초)

#### TC-AUTH-JWT-010: 짧은 secret 에러
- **입력**: 32자 미만 secret
- **기대 결과**: Error 발생

### 1.2 Password (auth/core/password)

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-AUTH-PWD-001 | 비밀번호 해싱 | bcrypt 해싱 |
| SC-AUTH-PWD-002 | 비밀번호 검증 | 해시 비교 |

#### TC-AUTH-PWD-001: 비밀번호 해싱
- **입력**: 평문 비밀번호
- **기대 결과**: bcrypt 해시 문자열 ($2a$ 또는 $2b$ 접두사)

#### TC-AUTH-PWD-002: 올바른 비밀번호 검증
- **입력**: 평문 비밀번호, 해시
- **기대 결과**: true

#### TC-AUTH-PWD-003: 틀린 비밀번호 검증
- **입력**: 잘못된 비밀번호, 해시
- **기대 결과**: false

---

## 2. error 모듈

### 2.1 AppError 클래스

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-ERR-001 | 에러 코드로 생성 | 5자리 에러 코드로 AppError 생성 |
| SC-ERR-002 | 에러 키로 생성 | 에러 키로 AppError 생성 |
| SC-ERR-003 | 팩토리 메서드 | 정적 팩토리 메서드로 생성 |
| SC-ERR-004 | 에러 변환 | 일반 Error를 AppError로 변환 |
| SC-ERR-005 | JSON 직렬화 | toJSON() 메서드 테스트 |

#### TC-ERR-001: 에러 코드로 생성
- **입력**: 40001 (BAD_REQUEST)
- **기대 결과**: status=400, category='validation'

#### TC-ERR-002: 에러 키로 생성
- **입력**: 'NOT_FOUND'
- **기대 결과**: code=40401, status=404

#### TC-ERR-003: 커스텀 메시지 포함
- **입력**: 40401, '링크를 찾을 수 없습니다'
- **기대 결과**: message에 커스텀 메시지 포함

#### TC-ERR-004: details 포함
- **입력**: 에러 코드, 메시지, { field: 'email' }
- **기대 결과**: details.field === 'email'

#### TC-ERR-005: 팩토리 메서드 - validation()
- **입력**: AppError.validation('잘못된 입력')
- **기대 결과**: 400xx 에러 코드

#### TC-ERR-006: 팩토리 메서드 - notFound()
- **입력**: AppError.notFound()
- **기대 결과**: 404xx 에러 코드

#### TC-ERR-007: 팩토리 메서드 - unauthorized()
- **입력**: AppError.unauthorized()
- **기대 결과**: 401xx 에러 코드

#### TC-ERR-008: 팩토리 메서드 - rateLimit()
- **입력**: AppError.rateLimit(60)
- **기대 결과**: 429xx 에러 코드, details.retryAfter=60

#### TC-ERR-009: Error → AppError 변환
- **입력**: new Error('일반 에러')
- **기대 결과**: AppError 인스턴스

#### TC-ERR-010: AppError → AppError 변환 (그대로 반환)
- **입력**: 기존 AppError
- **기대 결과**: 동일한 AppError 인스턴스

#### TC-ERR-011: toJSON() 직렬화
- **입력**: AppError 인스턴스
- **기대 결과**: { code, message, status, key, category, timestamp }

#### TC-ERR-012: toLogString() 로깅 형식
- **입력**: AppError 인스턴스
- **기대 결과**: "[code] message | category | requestId"

---

## 3. constants 모듈

### 3.1 error-codes

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-CONST-ERR-001 | 에러 코드 구조 | 5자리 코드 체계 검증 |
| SC-CONST-ERR-002 | HTTP 상태 매핑 | 에러 코드 → HTTP 상태 |
| SC-CONST-ERR-003 | 카테고리 분류 | 에러 코드 → 카테고리 |
| SC-CONST-ERR-004 | 메시지 포맷팅 | 에러 코드 + 메시지 포맷 |

#### TC-CONST-ERR-001: 모든 에러 코드가 5자리
- **검증**: ERROR_CODES의 모든 code가 10000-59999 범위

#### TC-CONST-ERR-002: getHttpStatus() - 400xx
- **입력**: 40001
- **기대 결과**: 400

#### TC-CONST-ERR-003: getHttpStatus() - 404xx
- **입력**: 40401
- **기대 결과**: 404

#### TC-CONST-ERR-004: getHttpStatus() - 500xx
- **입력**: 50001
- **기대 결과**: 500

#### TC-CONST-ERR-005: getErrorCategory() - validation
- **입력**: 40001
- **기대 결과**: 'validation'

#### TC-CONST-ERR-006: getErrorCategory() - authentication
- **입력**: 40101
- **기대 결과**: 'authentication'

#### TC-CONST-ERR-007: getErrorCategory() - permission
- **입력**: 40301
- **기대 결과**: 'permission'

#### TC-CONST-ERR-008: getErrorCategory() - resource
- **입력**: 40401
- **기대 결과**: 'resource'

#### TC-CONST-ERR-009: formatErrorMessage()
- **입력**: 40001, '잘못된 요청'
- **기대 결과**: '잘못된 요청 [40001]'

### 3.2 validation

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-CONST-VAL-001 | PASSWORD 상수 | 비밀번호 검증 상수 |
| SC-CONST-VAL-002 | USER_INPUT 상수 | 사용자 입력 제한 상수 |
| SC-CONST-VAL-003 | URL 상수 | URL 검증 상수 |

#### TC-CONST-VAL-001: PASSWORD 상수 존재
- **검증**: PASSWORD.MIN_LENGTH, PASSWORD.MAX_LENGTH 존재

#### TC-CONST-VAL-002: USER_INPUT 상수 존재
- **검증**: USER_INPUT.NAME_MAX_LENGTH 등 존재

---

## 4. cache 모듈

### 4.1 InMemoryCacheManager

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-CACHE-MEM-001 | 기본 CRUD | get, set, delete 동작 |
| SC-CACHE-MEM-002 | TTL 처리 | 만료 시간 처리 |
| SC-CACHE-MEM-003 | 패턴 삭제 | deletePattern 동작 |

#### TC-CACHE-MEM-001: set/get 기본 동작
- **입력**: key='test', value='value'
- **기대 결과**: get('test') === 'value'

#### TC-CACHE-MEM-002: TTL 만료
- **입력**: set('key', 'value', 100) (100ms TTL)
- **기대 결과**: 100ms 후 get('key') === null

#### TC-CACHE-MEM-003: delete 동작
- **입력**: set 후 delete('key')
- **기대 결과**: get('key') === null

#### TC-CACHE-MEM-004: deletePattern 동작
- **입력**: 'user:1:*', 'user:2:*' 키 설정 후 deletePattern('user:1:*')
- **기대 결과**: user:1:* 키만 삭제

#### TC-CACHE-MEM-005: clear 동작
- **입력**: 여러 키 설정 후 clear()
- **기대 결과**: 모든 키 삭제

### 4.2 NoOpCacheManager

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-CACHE-NOOP-001 | 항상 null | 캐시 비활성화 동작 |

#### TC-CACHE-NOOP-001: get 항상 null
- **입력**: get('any-key')
- **기대 결과**: null

#### TC-CACHE-NOOP-002: set 무동작
- **입력**: set('key', 'value')
- **기대 결과**: 에러 없음, get('key') === null

---

## 5. validators 모듈

### 5.1 PasswordValidator

| ID | 시나리오 | 설명 |
|----|----------|------|
| SC-VAL-PWD-001 | 기본 검증 | 최소 요구사항 검증 |
| SC-VAL-PWD-002 | 강도 계산 | 비밀번호 강도 점수 |
| SC-VAL-PWD-003 | 커스텀 옵션 | 커스텀 검증 옵션 |

#### TC-VAL-PWD-001: 유효한 비밀번호
- **입력**: 'Password123'
- **기대 결과**: isValid=true

#### TC-VAL-PWD-002: 짧은 비밀번호
- **입력**: 'Pass1'
- **기대 결과**: isValid=false, errors에 길이 오류

#### TC-VAL-PWD-003: 숫자 없는 비밀번호
- **입력**: 'PasswordOnly'
- **기대 결과**: isValid=false, errors에 숫자 오류

#### TC-VAL-PWD-004: 강도 - VERY_WEAK
- **입력**: 'abc'
- **기대 결과**: strength=VERY_WEAK

#### TC-VAL-PWD-005: 강도 - VERY_STRONG
- **입력**: 'MyP@ssw0rd!2024'
- **기대 결과**: strength=VERY_STRONG

#### TC-VAL-PWD-006: 커스텀 옵션 - 대문자 필수
- **입력**: 'password1', { requireUppercase: true }
- **기대 결과**: isValid=false

#### TC-VAL-PWD-007: 비밀번호 확인 일치
- **입력**: 'pass', 'pass'
- **기대 결과**: isValid=true

#### TC-VAL-PWD-008: 비밀번호 확인 불일치
- **입력**: 'pass1', 'pass2'
- **기대 결과**: isValid=false

---

## 6. utils 모듈 (기존 테스트 보완)

기존 `utils.test.ts`에서 다루는 범위:
- URL 정규화 (url-normalizer.ts) ✓
- ShortCode 생성 (short-code-generator.ts) ✓
- IP 유틸리티 (ip-utils.ts) ✓
- Sanitizer (sanitizer.ts) ✓
- 숫자 포맷팅 (format-number.ts) ✓
- 타임존 (timezone.ts) ✓

---

## 테스트 실행 방법

```bash
# 전체 테스트 실행
cd packages/@withwiz/toolkit && npm test

# 특정 파일 테스트
npm test -- auth-jwt.test.ts

# 커버리지 포함
npm test -- --coverage
```

---

## 커버리지 목표

| 모듈 | 목표 | 비고 |
|------|------|------|
| auth | 90%+ | 핵심 보안 모듈 |
| error | 95%+ | 에러 처리 핵심 |
| constants | 100% | 상수 검증 |
| cache | 90%+ | 캐시 동작 검증 |
| validators | 95%+ | 입력 검증 핵심 |
| utils | 95%+ | 유틸리티 함수 |
