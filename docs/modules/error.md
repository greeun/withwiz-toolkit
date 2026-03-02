# @withwiz/error

통합 에러 처리 시스템으로 API 미들웨어, 에러 로깅, UI 컴포넌트를 제공합니다.

## 주요 기능

- **AppError 클래스**: 표준화된 에러 객체
- **API 미들웨어**: 인증, Rate Limit, 에러 핸들링
- **다국어 에러 메시지**: 한국어/영어 지원
- **에러 UI 컴포넌트**: ErrorPage, ErrorAlert, EmptyState

## AppError 사용법

```typescript
import { AppError } from '@withwiz/error';
import { ERROR_CODES } from '@withwiz/constants/error-codes';

// 에러 생성
throw new AppError(ERROR_CODES.UNAUTHORIZED.code);

// 커스텀 메시지
throw new AppError(400, 'Invalid input', { field: 'email' });
```

## API 미들웨어

### 인증 미들웨어

```typescript
import { setJWTAdapter, authMiddleware } from '@withwiz/error/api/middlewares/auth';

// JWT 어댑터 설정 (프로젝트에서 구현)
setJWTAdapter({
  verifyJWT: async (token) => { /* ... */ },
  extractTokenFromHeader: (header) => { /* ... */ },
});

// 미들웨어 사용
const chain = new MiddlewareChain()
  .use(authMiddleware);
```

### Rate Limit 미들웨어

```typescript
import { setRateLimitAdapter, createRateLimitMiddleware } from '@withwiz/error/api/middlewares/rate-limit';

// Rate Limit 어댑터 설정
setRateLimitAdapter({
  rateLimiters: { api: myApiLimiter },
  extractClientIp: (headers) => { /* ... */ },
});

// 미들웨어 사용
const chain = new MiddlewareChain()
  .use(createRateLimitMiddleware('api'));
```

## 에러 UI 컴포넌트

```tsx
import { ErrorPage, ErrorAlert, EmptyState } from '@withwiz/error/components';

// 전체 페이지 에러
<ErrorPage error={error} />

// 인라인 에러 알림
<ErrorAlert message="Something went wrong" />

// 빈 상태 표시
<EmptyState message="No items found" />
```

## 에러 로깅

```typescript
import { logger } from '@withwiz/logger';

logger.error('Error occurred', { error, context });
logger.warn('Warning message', { data });
logger.info('Info message');
```
