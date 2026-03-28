# @withwiz/error

통합 에러 처리 시스템으로 5자리 에러코드 체계, AppError 클래스, 에러 분류, 다국어 메시지를 제공합니다.

## 에러코드 체계 (XXXYY)

HTTP 상태코드를 확장한 5자리 코드:

| 범위 | 카테고리 | 예시 |
|------|----------|------|
| 400xx | Validation | 40001 VALIDATION_ERROR |
| 401xx | Authentication | 40103 TOKEN_EXPIRED, 40104 LINK_PASSWORD_REQUIRED |
| 403xx (01-09) | Permission | 40304 FORBIDDEN |
| 403xx (71-79) | Security | 40371 ACCESS_BLOCKED, 40376 CORS_VIOLATION |
| 404xx | Resource | 40402 USER_NOT_FOUND |
| 409xx | Conflict | 40906 EMAIL_ALREADY_EXISTS |
| 422xx | Business Logic | 42204 LINK_EXPIRED |
| 429xx | Rate Limit | 42901 RATE_LIMIT_EXCEEDED |
| 500xx | Server Error | 50003 DATABASE_ERROR, 50007 CACHE_ERROR |
| 503xx | Service Unavailable | 50304 EXTERNAL_SERVICE_ERROR |

## AppError 사용법

```typescript
import { AppError } from '@withwiz/error';

// 팩토리 메서드 (권장)
throw AppError.notFound('링크를 찾을 수 없습니다');
throw AppError.unauthorized();
throw AppError.tokenExpired();
throw AppError.rateLimit(60);
throw AppError.databaseError('쿼리 실패');
throw AppError.serviceUnavailable('R2 미설정');
throw AppError.corsViolation('https://evil.com');

// 에러 코드 키로 생성
throw AppError.fromKey('VALIDATION_ERROR', '잘못된 입력', { field: 'email' });

// 5자리 코드로 직접 생성
throw new AppError(40402, '사용자를 찾을 수 없습니다');
```

### 알 수 없는 에러 변환

```typescript
try {
  await externalApi();
} catch (error) {
  // 자동 분류: DB, 네트워크, 캐시 등 패턴 인식
  throw AppError.from(error);
}
```

## classifyError — 자동 에러 분류

`classifyError(error)` 함수는 Error 인스턴스의 메시지/코드 패턴을 분석하여 적절한 에러코드를 반환합니다.

```typescript
import { classifyError } from '@withwiz/constants/error-codes';

const classified = classifyError(new Error('Redis connection timeout'));
// → { code: 50007, status: 500, key: 'CACHE_ERROR', ... }
```

분류 규칙:

| 패턴 | 분류 결과 |
|------|----------|
| `not found` | NOT_FOUND (404) |
| `unauthorized` | UNAUTHORIZED (401) |
| `forbidden`, `access denied` | FORBIDDEN (403) |
| `rate limit`, `too many request` | RATE_LIMIT_EXCEEDED (429) |
| Prisma `P\d{4}`, `database`, `prisma` | DATABASE_ERROR (500) |
| `ECONNREFUSED/RESET/TIMEOUT`, `fetch failed` | EXTERNAL_SERVICE_ERROR (503) |
| `redis`, `cache`, `upstash` | CACHE_ERROR (500) |
| `email` + `send/smtp` | EMAIL_SEND_FAILED (500) |
| `upload`, `s3`, `r2` | FILE_UPLOAD_FAILED (500) |
| 기타 | SERVER_ERROR (500) |

## AuthError 연동

`auth/errors`의 JWTError, OAuthError 등은 자동으로 AppError 체계 에러코드로 매핑됩니다:

```typescript
import { JWTError, AUTH_ERROR_CODES } from '@withwiz/auth/errors';

// JWTError('...', 'TOKEN_EXPIRED') → processError() → 40103 (401)
// OAuthError('...', 'OAUTH_TOKEN_EXCHANGE_FAILED') → 50304 (503)
// PasswordError('...', 'PASSWORD_HASH_FAILED') → 50002 (500)
```

## ErrorResponse 유틸리티

API 라우트에서 간편하게 에러 응답을 생성:

```typescript
import { ErrorResponse } from '@withwiz/error/error-handler';

// 400xx
return ErrorResponse.validation('필수 항목 누락');
return ErrorResponse.missingField('email');
return ErrorResponse.weakPassword();

// 401xx
return ErrorResponse.unauthorized();
return ErrorResponse.tokenExpired();
return ErrorResponse.linkPasswordRequired();

// 404xx
return ErrorResponse.notFound('페이지를 찾을 수 없습니다');
return ErrorResponse.userNotFound();

// 500xx
return ErrorResponse.databaseError();
return ErrorResponse.cacheError();

// 503xx
return ErrorResponse.externalServiceError('Payment API');

// 보안
return ErrorResponse.corsViolation();
return ErrorResponse.ipBlocked();
```

## 다국어 에러 메시지

```typescript
import { getErrorMessage } from '@withwiz/error/messages';

const msg = getErrorMessage(40103, 'ko');
// → { title: '로그인이 만료되었어요', description: '보안을 위해 세션이 만료되었습니다.', action: '다시 로그인해 주세요.' }
```

## 에러 핸들링 미들웨어

```typescript
import { errorHandlerMiddleware } from '@withwiz/middleware/error-handler';

// 미들웨어 체인 최상위에 배치
const chain = new MiddlewareChain()
  .use(errorHandlerMiddleware)  // AppError, ZodError, AuthError 자동 처리
  .use(authMiddleware);
```

## 프론트엔드 에러 표시

```typescript
import { showFriendlyError, handleApiResponse } from '@withwiz/error/error-display';

// 토스트 표시
showFriendlyError(40103, { locale: 'ko' });

// API 응답 처리 (에러 시 AppError throw)
const data = await handleApiResponse<User>(response, { showToast: true });
```
