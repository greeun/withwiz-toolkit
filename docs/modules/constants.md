# @withwiz/constants

범용 상수 정의로 에러 코드, 검증 규칙, 보안 설정 등을 제공합니다.

## 에러 코드

```typescript
import { ERROR_CODES, HTTP_STATUS, classifyError } from '@withwiz/constants/error-codes';

// HTTP 상태 코드
HTTP_STATUS.OK           // 200
HTTP_STATUS.BAD_REQUEST  // 400
HTTP_STATUS.UNAUTHORIZED // 401
HTTP_STATUS.FORBIDDEN    // 403
HTTP_STATUS.NOT_FOUND    // 404

// 표준 에러 코드 (5자리 XXXYY 형식)
ERROR_CODES.UNAUTHORIZED         // { code: 40101, status: 401, ... }
ERROR_CODES.INVALID_TOKEN        // { code: 40102, status: 401, ... }
ERROR_CODES.TOKEN_EXPIRED        // { code: 40103, status: 401, ... }
ERROR_CODES.LINK_PASSWORD_REQUIRED // { code: 40104, status: 401, ... }
ERROR_CODES.FORBIDDEN            // { code: 40304, status: 403, ... }
ERROR_CODES.NOT_FOUND            // { code: 40401, status: 404, ... }
ERROR_CODES.RATE_LIMIT_EXCEEDED  // { code: 42901, status: 429, ... }
ERROR_CODES.DATABASE_ERROR       // { code: 50003, status: 500, ... }
ERROR_CODES.EXTERNAL_SERVICE_ERROR // { code: 50304, status: 503, ... }

// 에러 자동 분류
const info = classifyError(new Error('Database connection lost'));
// → ERROR_CODES.DATABASE_ERROR
```

### 유틸리티 함수

```typescript
import {
  getErrorInfo,        // 키로 에러 정보 조회
  getErrorByCode,      // 5자리 코드로 조회
  getHttpStatus,       // 5자리 코드 → HTTP 상태 (40907 → 409)
  getErrorCategory,    // 카테고리 분류 (validation, auth, server 등)
  getLogLevel,         // 상태코드 → 로그 레벨
  classifyError,       // Error → 가장 적합한 에러코드 자동 매핑
} from '@withwiz/constants/error-codes';
```

## 검증 상수

```typescript
import { PASSWORD, USER_INPUT, URL } from '@withwiz/constants/validation';

// 비밀번호 검증
PASSWORD.MIN_LENGTH  // 8
PASSWORD.MAX_LENGTH  // 128

// 사용자 입력
USER_INPUT.MAX_NAME_LENGTH  // 100
USER_INPUT.MAX_EMAIL_LENGTH // 255

// URL 검증
URL.MAX_LENGTH  // 2048
URL.SUPPORTED_SCHEMES  // ['http', 'https', 'mailto', ...]
```

## 페이지네이션

```typescript
import { PAGINATION } from '@withwiz/constants/pagination';

PAGINATION.DEFAULT_PAGE      // 1
PAGINATION.DEFAULT_PAGE_SIZE // 20
PAGINATION.MAX_PAGE_SIZE     // 100
```

## 보안 상수

```typescript
import { SECURITY } from '@withwiz/constants/security';

SECURITY.JWT_EXPIRY        // '7d'
SECURITY.REFRESH_EXPIRY    // '30d'
SECURITY.MAX_LOGIN_ATTEMPTS // 5
```
