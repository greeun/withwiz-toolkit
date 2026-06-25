# Features

Feature catalog for **@withwiz/toolkit** `0.9.0` — generated from the current
source tree. One row per public export, grouped by npm subpath.

- **Tiers**: `core` (zero framework deps) · `next` (Next.js) · `prisma` (Prisma ORM).
  Tier rules in [`FRAMEWORK_TIERS.md`](./FRAMEWORK_TIERS.md), source layout in
  [`MODULE_STRUCTURE.md`](./MODULE_STRUCTURE.md), usage recipes in
  [`MODULE_USAGE.md`](./MODULE_USAGE.md).
- **Imports** are granular for tree-shaking:
  `import { signToken } from '@withwiz/toolkit/core/auth/jwt'`.

## Table of Contents

- [Composition root](#composition-root) — `initialize`
- [core/auth](#coreauth) — JWT, password, OAuth, services, email, SQL adapter
- [core/cache](#corecache) — Redis / in-memory / hybrid / noop caching
- [core/error](#coreerror) — `AppError`, friendly messages, i18n
- [core/config](#coreconfig) — config registry
- [core/constants](#coreconstants) — error codes, messages, pagination, security, validation
- [core/cors](#corecors) — CORS config
- [core/geolocation](#coregeolocation) — GeoIP lookup + providers
- [core/logger](#corelogger) — Winston structured logging
- [core/storage](#corestorage) — Cloudflare R2 / S3 storage
- [core/system](#coresystem) — system + health monitoring
- [core/types](#coretypes) — shared TypeScript types
- [core/utils](#coreutils) — sanitizer, validation, IP, timezone, formatting
- [core/validators](#corevalidators) — password validator
- [next/auth-handlers](#nextauth-handlers) — Next.js auth route handlers
- [next/auth-types](#nextauth-types) — handler config types
- [next/error](#nexterror) — error responses, `ErrorBoundary`, locale
- [next/middleware](#nextmiddleware) — auth, rate-limit, CORS, security, chain
- [next/utils](#nextutils) — API helpers, CSV export, error processor, CORS
- [prisma/auth-adapter](#prismaauth-adapter) — Prisma auth repositories

---

## Composition root

### `initialize`
`import { initialize, config } from '@withwiz/toolkit/initialize'`

Single entry point that wires every tier's config into one registry.

| Export | Kind | Purpose |
|--------|------|---------|
| `initialize(toolkitConfig)` | function | Assemble all subsystems → `ConfigRegistry`. Accepts `{ nodeEnv?, auth?, logger?, cache?, storage?, geolocation?, cors? }` (all optional) |
| `config` | const | Global `ConfigRegistry` singleton |
| `resetConfig()` | function | Reset the registry (testing) |
| `ToolkitConfig` | interface | Union config for all subsystems |
| `AuthConfig` · `LoggerConfig` · `CacheConfig` · `StorageConfig` · `GeolocationConfig` · `CorsConfig` | types | Per-subsystem config shapes (re-exported) |
| `ConfigRegistry` | type | Registry interface |

---

## core/auth

### core/auth/jwt
`@withwiz/toolkit/core/auth/jwt`

| Export | Kind | Purpose |
|--------|------|---------|
| `JWTManager` | class | Server JWT: `createAccessToken`, `verifyAccessToken`, `createRefreshToken`, `verifyRefreshToken`, `createTokenPair`, `extractTokenFromHeader`, expiry helpers. Symmetric + asymmetric algs |
| `JWTService` | class | Lightweight JWT wrapper (`sign`/`verify`) for tests/basic use, no Logger |

### core/auth/jwt/client
`@withwiz/toolkit/core/auth/jwt/client`

| Export | Kind | Purpose |
|--------|------|---------|
| `JWTClientManager` | class | Client-side token storage in `localStorage` + decode helpers |
| `getStoredTokens` · `storeTokens` · `clearStoredTokens` · `clearTokens` | functions | localStorage token persistence (default-instance helpers) |
| `decodeJWTPayload` · `isTokenExpired` · `getTokenRemainingTime` · `isTokenExpiringSoon` | functions | Client-side, no-verify token inspection |
| `extractUserFromToken` · `getUserRole` | functions | Read user id/email/role from token |
| `createAuthHeader` · `createApiHeaders` | functions | Build `Bearer` / full request headers |
| `getTokenExpirationString` · `getTokenIssuedAtString` | functions | Locale-formatted token times |

### core/auth/jwt/cookie
`@withwiz/toolkit/core/auth/jwt/cookie`

| Export | Kind | Purpose |
|--------|------|---------|
| `setTokenCookies<T>(response, tokenPair, options?)` | function | Set httpOnly access/refresh cookies |
| `clearTokenCookies<T>(response, options?)` | function | Clear both token cookies |
| `CookieOptions` | interface | `{ secure?, sameSite?, domain?, refreshTokenPath? }` |

### core/auth/password
`@withwiz/toolkit/core/auth/password` (+ `/hasher`, `/client-helper`)

| Export | Kind | Purpose |
|--------|------|---------|
| `PasswordValidator` | class | Validate password, score strength, build Zod schema, hints |
| `PasswordHasher` | class | Basic bcrypt hash/verify wrapper |
| `IPasswordHasher` | interface | Pluggable hasher contract (`id`, `identifies`, `hash`, `verify`, `needsRehash`) |
| `BcryptPasswordHasher` | class | bcryptjs hasher (default) |
| `Argon2idPasswordHasher` | class | argon2id hasher (optional dependency) |
| `MigratingPasswordHasher` | class | Composite rehash-on-login (preferred + legacy schemes) |
| `BcryptHasherOptions` · `Argon2idHasherOptions` · `MigratingHasherOptions` | interfaces | Hasher config shapes |
| `defaultPasswordSchema` · `strongPasswordSchema` | Zod schemas | 8+/number · 12+/upper+lower+number+special |
| `DEFAULT_PASSWORD_CONFIG` | const | Default `PasswordConfig` |
| `createPasswordValidator` · `validatePassword` · `getPasswordStrength` · `createPasswordSchema` · `createPasswordHasher` | functions | Client-helper factories |
| `passwordValidator` | singleton | Pre-built validator with defaults |

### core/auth/oauth
`@withwiz/toolkit/core/auth/oauth` (+ `/providers`, `/providers/{google,github,kakao,microsoft,meta}`, `/state-cookie`)

| Export | Kind | Purpose |
|--------|------|---------|
| `OAuthManager` | class | Provider registry + token exchange (`registerProvider`, `getLoginUrl`, `exchangeCodeForToken`, `getUserInfo`) |
| `GoogleOAuthProvider` · `GitHubOAuthProvider` · `KakaoOAuthProvider` · `MicrosoftOAuthProvider` · `MetaOAuthProvider` | classes | Per-provider adapters (Microsoft does id_token JWKS verification) |
| `OAUTH_STATE_COOKIE` | const | `'oauth_state'` cookie name |
| `generateOAuthState()` | function | Random UUID CSRF nonce |
| `setOAuthStateCookie` · `clearOAuthStateCookie` | functions | Manage httpOnly state cookie (10-min expiry) |
| `validateOAuthState(cookieValue, queryState)` | function | CSRF state match check |
| `OAuthStateCookieOptions` | interface | `{ secure?, sameSite?, domain? }` |

### core/auth/services
`@withwiz/toolkit/core/auth/services` (+ per-service subpaths)

| Export | Kind | Purpose |
|--------|------|---------|
| `LoginService` | class | `login(email, password, storedHash)` → user + tokens (+ optional rehash) |
| `RegisterService` | class | `register(input)` → user + verification-sent flag |
| `OAuthCallbackService` | class | `handleCallback(input)` → user + tokens + isNewUser |
| `TokenRefreshService` | class | `refresh(refreshToken)` → new tokens (rotation, blacklist, family revoke) |
| `PasswordResetService` | class | `requestReset(email)` / `resetPassword(email, token, newPassword)` |
| `EmailVerificationService` | class | `verify(email, token)` / `resend(email)` |
| `IRefreshTokenStore` · `RefreshTokenRecord` | interfaces | Refresh-token reuse-detection store contract |
| `*ServiceConfig`, `*Input`, `*Result` | interfaces | Per-service config / input / result shapes |

### core/auth/email
`@withwiz/toolkit/core/auth/email` (+ `/sender`, `/token-generator`)

| Export | Kind | Purpose |
|--------|------|---------|
| `SmtpEmailSender` | class | Send verification / password-reset / magic-link / welcome emails |
| `SmtpConfig` | interface | `{ host, port, user, pass, from, baseUrl, secure?, templates? }` |
| `EmailTemplates` | interface | Customizable per-mail template functions |
| `TokenGenerator` | class (static) | `generate`, `hash` (SHA-256), `generateUrlSafe`, `generatePIN`, `calculateExpiry`, `isExpired` |

### core/auth/adapters/sql
`@withwiz/toolkit/core/auth/adapters/sql`

Raw-SQL repository implementations (Postgres / MySQL) for projects without an ORM.

| Export | Kind | Purpose |
|--------|------|---------|
| `SqlUserRepository` | class | `UserRepository` over raw SQL |
| `SqlOAuthAccountRepository` | class | `OAuthAccountRepository` over raw SQL |
| `SqlEmailTokenRepository` | class | `EmailTokenRepository` over raw SQL |
| `QueryExecutor` | interface | `{ query(sql, params) }` — bring-your-own driver |
| `SqlDialect` | type | `'postgres' \| 'mysql'` |
| `SqlAdapterConfig` · `ResolvedSqlConfig` | interfaces | Table/column customization |
| `getDialect` · `resolveConfig` · `columnList` · `ParamBuilder` · `DialectStrategy` | helpers | Dialect placeholder/quote utilities |

### core/auth/config · token-delivery · types · errors

| Subpath | Export | Kind | Purpose |
|---------|--------|------|---------|
| `core/auth/config` | `initializeAuth` · `getAuthConfig` · `resetAuth` | functions | Global auth config lifecycle |
| | `AuthConfig` · `ResolvedAuthConfig` · `TokenDelivery` | types | Config shapes; `TokenDelivery` = `'cookie' \| 'header' \| 'hybrid'` |
| `core/auth/token-delivery` | `resolveTokenDelivery` · `getTokenDeliveryStrategy` | functions | Resolve + strategy for cookie/header/hybrid token transport |
| | `TokenDeliveryStrategy` · `TokenSource` | interfaces | Strategy contracts |
| `core/auth/types` | `BaseUser`, `UserRepository`, `OAuthAccount`, `OAuthAccountRepository`, `EmailToken`, `EmailTokenRepository`, `JWTPayload`, `TokenPair`, `JWTConfig`, `OAuthUserInfo`, `IOAuthProviderAdapter`, `EmailSender`, `Logger`, `PasswordStrength` (enum), `TokenType` (enum), `OAUTH_PROVIDERS`, … | types | All shared auth domain types + repository contracts |
| `core/auth/errors` | `AuthError`, `JWTError`, `OAuthError`, `EmailError`, `PasswordError` | classes | Typed auth errors |
| | `AUTH_ERROR_CODES` | const | Auth error-code string constants |

---

## core/cache
`@withwiz/toolkit/core/cache` (+ many subpaths)

Pluggable cache with Redis / in-memory / hybrid / noop backends, factory selection, invalidation, and a fetch-wrapper.

| Export | Kind | Purpose |
|--------|------|---------|
| `getCacheManager(prefix)` | function | Factory → Redis / Hybrid / InMemory / Noop manager by env |
| `getEffectiveCacheBackend()` | function | Active backend: `'redis' \| 'memory' \| 'hybrid' \| 'none'` |
| `cache` · `geoCache` | consts | Default + GeoIP cache instances |
| `withCache<T>(key, fetchFn, options?)` | function | Cache-or-fetch wrapper with prefix + null handling |
| `cacheMetrics` | object | Hit/miss/error metrics + `hitRate`, `reset()` |
| `invalidateCache` | object | `byKey` / `byPattern` / `geoByKey` / `geoByPattern` / `all` / `allGeo` |
| `deleteFromCache` · `deletePatternFromCache` · `deletePatternFromMultipleCaches` | functions | Lower-level invalidation |
| `RedisCacheManager` · `InMemoryCacheManager` · `HybridCacheManager` · `NoopCacheManager` | classes | Backend managers (all implement `IUnifiedCacheManager`) |
| `IUnifiedCacheManager` | interface | `get`/`set`/`delete`/`deletePattern`/`exists`/`getMetrics`/`getConnectionStatus`/`checkConnection` |
| `initializeCache` · `getResolvedCacheConfig` · `isCacheConfigInitialized` · `resetCache` | functions | Cache config lifecycle |
| `CacheConfigInput` · `ResolvedCacheConfig` · `CacheOptions` · `CacheBackendType` | types | Config + option shapes |
| Redis helpers | functions | `checkRedisConnection`, `isRedisAvailableNow`, `getRedisClient`, `notifyRedisError`, `getRedisGlobalStatus`, `isRedisGloballyDisabled`, `resetRedisGlobalState` |
| Env/config helpers | functions | `isCacheEnabled`, `validateRedisEnvironment`, `getCacheConfig`, `getCacheFallbackConfig`, `getCacheHealthConfig` |
| Defaults | consts | `INMEMORY_CACHE_DEFAULTS`, `CACHE_TTL_DEFAULTS`, `CACHE_DURATION_DEFAULTS`, `CACHE_ENV_VARS`, time units (`ONE_MINUTE`…`THIRTY_DAYS`) |

Backend-specific subpaths: `cache-factory`, `cache-invalidation`, `cache-redis`, `cache-wrapper`, `cache-types`, `cache-defaults`, `cache-env`, `config`, `{redis,inmemory,hybrid,noop}-cache-manager`.

---

## core/error
`@withwiz/toolkit/core/error` (+ `/app-error`, `/extract-error-info`, `/friendly-messages-v2`, `/messages`)

| Export | Kind | Purpose |
|--------|------|---------|
| `AppError` | class | Unified app error with 5-digit codes + 40+ static factory methods (validation/auth/resource/conflict/business/rateLimit/server) |
| `extractErrorInfo(error)` | function | Normalize unknown → `{ code, message, stack? }` |
| `getFriendlyMessage` · `getErrorDisplayInfo` · `formatFriendlyError` | functions | User-facing multi-language messages + display info |
| `getErrorMessage` · `getAllMessages` · `hasMessage` · `isLocaleSupported` | functions | i18n message lookup (`ko`/`en`/`ja`) |
| `supportedLocales` | const | `['ko','en','ja']` |
| `ISerializedError` · `IErrorDetails` · `IErrorDisplay` · `IErrorMessage` · `TLocale` · `TErrorMessages` · `IDefaultMessages` | types | Error + message shapes |

---

## core/config
`@withwiz/toolkit/core/config` (+ `/common`, `/errors`, `/registry`)

| Export | Kind | Purpose |
|--------|------|---------|
| `config` | const | Global `ConfigRegistry` (common, auth, logger, cache?, storage?, geolocation?, cors?) |
| `resetConfig()` | function | Clear all config |
| `initializeCommon` · `getCommonConfig` · `resetCommon` | functions | Common (`nodeEnv`) config lifecycle |
| `initializeCors` · `getCorsConfig` · `resetCors` | functions | CORS config lifecycle |
| `ConfigurationError` | class | Thrown on config errors |
| `CommonConfig` · `ResolvedCommonConfig` · `CorsConfig` · `ResolvedCorsConfig` · `ConfigRegistry` | types | Config shapes |

---

## core/constants
`@withwiz/toolkit/core/constants` (+ `/error-codes`, `/messages`, `/pagination`, `/security`, `/validation`)

| Group | Export | Purpose |
|-------|--------|---------|
| error-codes | `ERROR_CODES` · `HTTP_STATUS` | 40+ typed error codes (5-digit) + HTTP status map |
| | `getErrorInfo` · `getErrorByCode` · `getHttpStatus` · `getErrorCategory` · `getDefaultErrorMessage` · `getLogLevel` · `getAllErrorCodes` · `getErrorCodesByCategory` · `formatErrorMessage` · `classifyError` | Error-code lookup/classification helpers |
| | `ErrorCodeKey` · `ErrorCodeValue` · `IErrorCodeInfo` | types |
| messages | `GENERIC_ERROR_MESSAGES` · `GENERIC_SUCCESS_MESSAGES` · `GENERIC_CONFIRM_MESSAGES` · `GENERIC_INFO_MESSAGES` | Reusable message banks |
| pagination | `PAGINATION` · `PAGE_SIZES` · `SORT_OPTIONS` · `FILTER_OPTIONS` · `DATE_RANGE` | List/sort/filter defaults |
| security | `JWT_DEFAULTS` · `ROLE_DEFAULTS` · `EMAIL_VERIFICATION` · `PASSWORD_RESET` · `MAGIC_LINK` · `SESSION` · `OAUTH` · `CSRF` · `SECURITY_HEADERS` | Auth/security defaults |
| validation | `PASSWORD` · `USER_INPUT` · `URL` · `TEXT` · `NUMERIC` · `DATE` · `FILE_UPLOAD` | Input-length / file-upload limits |

---

## core/cors
`@withwiz/toolkit/core/cors`

| Export | Kind | Purpose |
|--------|------|---------|
| `initializeCors` · `getCorsConfig` · `resetCors` | functions | Pure CORS config lifecycle (framework-free) |
| `CorsConfig` · `ResolvedCorsConfig` | interfaces | `{ allowedOrigins, baseUrl? }` |

---

## core/geolocation
`@withwiz/toolkit/core/geolocation` (+ `/config`, `/batch-processor`, `/providers/*`)

| Export | Kind | Purpose |
|--------|------|---------|
| `GeoIPProviderFactory` | class | Select/register GeoIP providers, pick optimal, collect stats |
| `BaseGeoIPProvider` | class | Abstract provider base (`fetchGeoData`, rate-limit, timeout) |
| `IPApiProvider` · `IPApiCoProvider` · `IPGeolocationProvider` · `MaxMindProvider` | classes | Concrete providers (free → paid; keys required for paid) |
| `BatchProcessor<T,R>` · `createBatchProcessor` | class/factory | Batch + retry + concurrent processing with progress |
| `truncateString` | function | String-length utility |
| `initializeGeolocation` · `getGeolocationConfig` · `resetGeolocation` | functions | Config lifecycle (`ipgeolocationApiKey`, `maxmindLicenseKey`) |
| `GeolocationConfig` · `ResolvedGeolocationConfig` + `IGeoIP*` types | types | Config + service/provider type set |

---

## core/logger
`@withwiz/toolkit/core/logger/logger` (+ `/config`)

| Export | Kind | Purpose |
|--------|------|---------|
| `logger` | winston instance | Global structured logger |
| `logDebug` · `logInfo` · `logError` | functions | Level-specific logging with metadata |
| `logApiRequest` · `logApiResponse` | functions | Async-safe request/response logging |
| `initializeLogger` · `getLoggerConfig` · `resetLogger` | functions | Logger config lifecycle (level, dir, file/console toggles) |
| `LoggerConfig` · `ResolvedLoggerConfig` | interfaces | Config shapes |

---

## core/storage
`@withwiz/toolkit/core/storage` (+ `/config`, `/r2-storage`)

| Export | Kind | Purpose |
|--------|------|---------|
| `uploadToR2(key, body, contentType)` | function | Upload → `{ key, url, size }` |
| `getFromR2(key)` | function | Read → `{ body, contentType } \| null` |
| `deleteFromR2(key)` | function | Delete object |
| `isR2Enabled` · `resetR2` | functions | Config check / reset |
| `initializeStorage` · `getStorageConfig` · `resetStorage` | functions | R2/S3 config lifecycle |
| `StorageConfig` · `ResolvedStorageConfig` · `R2Config` | interfaces | Config shapes (accountId, keys, bucket) |

---

## core/system
`@withwiz/toolkit/core/system` (+ `/cpu`, `/memory`, `/disk`, `/network`, `/environment`, `/health-check`, `/types`)

| Export | Kind | Purpose |
|--------|------|---------|
| `getSystemInfo()` | function | Full system snapshot (cpu/mem/disk/network/env/services) |
| `getSimpleSystemInfo()` | function | Condensed snapshot |
| `getCpuInfo` · `getMemoryInfo` · `getDiskInfo` · `getNetworkInfo` | functions | Per-resource metrics (macOS + Linux fallbacks) |
| `checkEnvironmentVariables()` | function | Config-presence report for known env vars |
| `checkServiceHealth(prismaClient?)` | function | DB + Redis health check |
| `ISystemInfo` · `ICpuInfo` · `IMemoryInfo` · `IDiskInfo` · `INetworkInfo` · `IEnvironmentInfo` · `IServiceInfo` | interfaces | Result shapes |

---

## core/types
`@withwiz/toolkit/core/types/*`

| Subpath | Main exports |
|---------|--------------|
| `api` | `IApiResponse<T>` |
| `database` | `IGeoLocationData`, `IGeoIPResponse`, `IDatabaseService`, `ICacheService<T>` |
| `env` | `ICacheEnv`, `ICacheTTLConfig`, `ICacheCategoryConfig`, `IInMemoryCacheEnv`, `IRawEnv`, `ISharedEnvConfig`, `CacheBackendType`, `IRedisEnv` (deprecated) |
| `geoip` | `IGeoIPConfig`, `IGeoIPService`, `IGeoIPProvider`, `IBatchProcessorConfig`, `IBatchProcessResult`, `IGeographyAnalytics`, `IGeoIPStats`, `IGeoIPError`, `IGeoIPCacheEntry`, `IGeoIPPreset`, `IGeoIPApiResponse`, `IGeoIPServiceFactory`, `IGeoIPBatchProcessor` |
| `i18n` | `Locale`, `II18nConfig` |
| `qr-code` | `IQRCodeSettings`, `IQRCodeConfig`, `IQRTemplate`, `IQRCodeStats`, `IQRCodeAnalytics`, `IQRCodeDownloadOptions`, `DEFAULT_QR_SETTINGS`, `QR_CODE_TEMPLATES` |
| `user` | `IUser`, `IUserCreateData`, `IUserUpdateData`, `IUserFilters`, `IUserSortOptions`, `IUserListResult<T>` |

---

## core/utils
`@withwiz/toolkit/core/utils/*`

| Subpath | Export | Purpose |
|---------|--------|---------|
| `sanitizer` | `sanitizeHtml` · `sanitizeUrl` · `sanitizeInput` · `removeEventHandlers` · `sanitizeArray` · `sanitizeObjectFields` | XSS-safe string/object sanitization |
| `type-guards` | `isDefined` · `isPresent` · `isString` · `isNumber` · `isObject` · `isArray` · `isValidEmail` · `isValidUrl` · `isIPAddress` · `isValidDate` · `isEmpty` · `isApiSuccessResponse` … (30+) | Runtime type guards |
| `input-validation` | `validateURL` · `validateInput` · `validateFilename` · `escapeHTML` · `detectXSS` · `detectSQLInjection` · `detectPathTraversal` · `sanitizeInput` | Security input validation (SSRF/XSS/SQLi/path-traversal) |
| `ip-utils` | `isPrivateIP` · `isValidIP` · `isIPv6` · `normalizeIP` · `extractClientIp` | IP parsing + client-IP extraction (CF / X-Forwarded-For, SSRF-safe) |
| `url-normalizer` | `normalizeUrl` · `validateUrl` · `hasValidScheme` · `extractScheme` · `isWebUrl` · `isAppScheme` · `getUrlType` · `SUPPORTED_SCHEMES` | URL normalization + scheme whitelist |
| `timezone` | `getCurrentUTC` · `utcToLocal` · `localToUTC` · `formatUserFriendlyDate` · `formatSimpleDate` · `formatFullDateTime` · `formatTableDateTime` · `getRelativeTime` · `getUserTimezone` · `toUTCISOString` | Timezone-aware date conversion/formatting |
| `format-number` | `formatNumber` · `formatChartNumber` | Human-readable number formatting (K/M abbreviation) |
| `error-message-formatter` | `formatRedisError` · `formatDatabaseError` · `formatGenericError` | Clean error strings for display |
| `short-code-generator` | `generateShortCode` · `generateUniqueShortCode` | CSPRNG alphanumeric short codes (+ dedupe) |
| `optimistic-lock` | `withOptimisticLock` | Throw 40904 on zero-row concurrent update |

---

## core/validators
`@withwiz/toolkit/core/validators/password-validator`

| Export | Kind | Purpose |
|--------|------|---------|
| `PasswordValidator` | class (static) | `validate`, `createZodSchema`, `validateConfirmation`, `generateHint`, `getStrengthMessage`, `getStrengthColor` |
| `PasswordStrength` | enum | `VERY_WEAK`…`VERY_STRONG` |
| `IPasswordValidationResult` · `IPasswordValidationOptions` | interfaces | Result (`isValid`, `errors`, `strength`, `score`) + rule options |
| `defaultPasswordSchema` · `strongPasswordSchema` | Zod schemas | Standard / strong policies |

---

## next/auth-handlers
`@withwiz/toolkit/next/auth-handlers` (+ per-handler subpaths)

Factories that turn `AuthHandlerOptions` into Next.js route handlers `(req: NextRequest) => Promise<Response>`.

| Export | Kind | Purpose |
|--------|------|---------|
| `createLoginHandler` | factory | Email/password login + pre/post hooks |
| `createRegisterHandler` | factory | Register + optional email verification |
| `createLogoutHandler` | factory | Logout + token blacklist |
| `createRefreshHandler` | factory | Access/refresh token rotation |
| `createMeHandler` | factory | Return authenticated user |
| `createOAuthAuthorizeHandler` · `createOAuthCallbackHandler` | factories | OAuth redirect + callback exchange |
| `createForgotPasswordHandler` · `createResetPasswordHandler` | factories | Password-reset flow |
| `createVerifyEmailHandler` | factory | Email verification |
| `createAuthHandlers` | factory | Bundle all 10 handlers → `AuthRouteHandlers` |
| `AuthRouteHandlers` | interface | Handler bundle type |

## next/auth-types
`@withwiz/toolkit/next/auth-types` (+ `/handler-types`)

| Export | Kind | Purpose |
|--------|------|---------|
| `AuthHandlerOptions` | interface | Full handler config (dependencies, providers, jwt, urls, features, hooks, cookies, tokenDelivery) |
| `AuthHandlerDependencies` | interface | Required repositories + optional emailSender/logger |
| `AuthHandlerHooks` | interface | Lifecycle hooks (`onAfterLogin`, `extendUserResponse`, `isTokenBlacklisted`, …) |
| `AuthHandlerUrls` | interface | Redirect URL config |
| `AuthHandlerResult` | interface | GET/POST handler shape |
| `resolveTokenDelivery` | function | Token-delivery mode resolver (re-export) |

## next/error
`@withwiz/toolkit/next/error` (+ `/error-handler`, `/ErrorBoundary`, `/locale-detector`)

| Export | Kind | Purpose |
|--------|------|---------|
| `errorToResponse(error, requestPath?)` | function | Any error → `NextResponse` (with logging) |
| `processError(error)` | function | Error → `{ code, message, status, details? }` |
| `withErrorHandler(handler)` | wrapper | Wrap route handler with error catching |
| `ErrorResponse` | object | 40+ typed response builders (`unauthorized`, `notFound`, `rateLimit`, …) |
| `AUTH_ERROR_CODE_MAP` · `IErrorResponse` | const/interface | Auth-code → HTTP map; response shape |
| `ErrorBoundary` | React component | Localized error UI (ko/en), dev stack, refresh/home |
| `ErrorCard` · `InlineError` | React components | Section + form-field error UI |
| `LocaleDetector` | class (static) | `detectClient` / `detectServer` / `setClientLocale` / `clearClientLocale` / `isValidLocale` |

## next/middleware
`@withwiz/toolkit/next/middleware` (+ subpaths)

Composable API middleware: build a chain or use prebuilt wrappers.

| Export | Kind | Purpose |
|--------|------|---------|
| `withPublicApi` · `withAuthApi` · `withAdminApi` · `withOptionalAuthApi` | wrappers | Prebuilt middleware chains (error→security→cors→init→[auth]→rateLimit→logger) |
| `withCustomApi(handler, configureChain)` | wrapper | User-defined chain |
| `MiddlewareChain` | class | `use()` / `execute()` composition |
| `authMiddleware` · `optionalAuthMiddleware` · `adminMiddleware` · `createRoleMiddleware(...roles)` | middlewares | JWT / role gating |
| `setAccessTokenBlacklistChecker` · `initializeAuthMiddleware` | functions | Auth middleware DI/init |
| `rateLimitMiddleware` · `createRateLimitMiddleware(type)` · `setRateLimitAdapter` | middleware/factory/DI | Rate limiting (`api`/`auth`/`admin` + custom) |
| `corsMiddleware` · `createCorsMiddleware(config)` · `validateCorsConfiguration` | middleware/factory | CORS |
| `securityMiddleware` · `setAllowedOrigins` · `validateSecurityConfiguration` | middleware/fn | CSRF + security headers |
| `errorHandlerMiddleware` · `initRequestMiddleware` · `responseLoggerMiddleware` | middlewares | Error catch / request init (id, locale) / response logging |
| `IApiContext` · `TApiHandler` · `TApiMiddleware` · `IUser` · `IRateLimiter` · `IRateLimitAdapter` · `IAccessTokenBlacklistChecker` · `CorsMiddlewareConfig` · `IMiddlewareChainOptions` | types | Middleware contracts |

## next/utils
`@withwiz/toolkit/next/utils` (+ subpaths)

| Subpath | Export | Purpose |
|---------|--------|---------|
| `api-helpers` | `validateAndParse` · `parsePagination` · `parseSort` · `parseFilters` · `createPaginatedResponse` · `requireAdmin` · `parseRequestBody` · `getSearchParam` · `parseBooleanParam` · `parseNumberParam` · `getUserAgent` · `getReferer` | Request parsing + paginated responses |
| `error-processor` | `ErrorProcessor` · `withErrorHandling` · `handlePrismaError` · `throwNotFoundError` / `throwConflictError` / `throwForbiddenError` / `throwUnauthorizedError` / `throwValidationError` / `throwBadRequestError` / `throwBusinessRuleError` · `processError` · `errorToResponse` | Central error processing (incl. Prisma codes) |
| `csv-export` | `createSimpleCsvResponse` · `createStreamingCsvResponse` · `escapeCsvField` · `rowToCsv` · `createCsvHeader` · `dateFormatter` · `boolFormatter` · `CsvColumn` · `CsvExportOptions` · `BatchExportOptions` | CSV export (in-memory + streaming) |
| `csv-export-format` | `customDateFormatter` | date-fns formatter (optional peer) |
| `cors` | `withCORS` · `withRestrictedCORS` · `withPublicCORS` · `setCorsHeaders` · `isOriginAllowed` · `getAllowedOrigins` · `initCorsConfig` · `getCorsConfig` | Route-level CORS wrappers/helpers |

---

## prisma/auth-adapter
`@withwiz/toolkit/prisma/auth-adapter`

Prisma repository implementations of the `core/auth` repository contracts. Uses
duck-typing (`PrismaClientLike`) for Prisma 7 per-project client paths.

| Export | Kind | Purpose |
|--------|------|---------|
| `PrismaUserRepository` | class | `UserRepository` via Prisma (`findById`, `findByEmail`, `create`, `update`, `delete`, `updateLastLoginAt`, `verifyEmail`) |
| `PrismaOAuthAccountRepository` | class | `OAuthAccountRepository` via Prisma (Account + AccountToken) |
| `PrismaEmailTokenRepository` | class | `EmailTokenRepository` via Prisma (configurable token tables) |
| `PrismaAdapterConfig` | interface | `tokenTables` (model names) + `userFields` (field name mapping) |
