# @withwiz/toolkit - Product Requirements Document

> **Summary**: Shared utility library providing production-ready modules for authentication, caching, error handling, middleware, logging, geolocation, and component libraries for withwiz projects.
>
> **Author**: withwiz Team
> **Created**: 2026-03-03
> **Last Modified**: 2026-03-03
> **Status**: Approved
> **Version**: 0.1.1

---

## 1. Overview & Purpose

### 1.1 Problem Statement

The withwiz project ecosystem consists of multiple applications (web, mobile, admin) that require common functionality for:
- User authentication and authorization
- Distributed caching strategies
- Structured error handling and recovery
- API middleware (rate limiting, CORS, security)
- Logging and monitoring
- Geolocation services
- Reusable UI components
- Type-safe utilities

Currently, these functionalities are duplicated across projects, leading to:
- Code duplication and maintenance burden
- Inconsistent error handling and logging patterns
- Fragmented type definitions
- Difficulty in sharing component designs

### 1.2 Solution

Create **@withwiz/toolkit** — a centralized, npm-published shared utility library that:
- Consolidates common functionality into well-designed, reusable modules
- Provides granular subpath exports for tree-shaking and small bundle sizes
- Ensures consistency across withwiz projects
- Reduces development time and maintenance burden
- Enables rapid feature development in consuming projects

### 1.3 Target Users

- **Internal**: withwiz development teams building Next.js/React applications
- **External**: Third-party developers integrating with withwiz ecosystem (future)

---

## 2. Scope

### 2.1 In Scope ✅

**Core Modules** (released in v0.1.0+):

| Module | Responsibilities |
|--------|------------------|
| **Auth** | JWT token management, password hashing (bcrypt), OAuth helpers, Prisma session adapter |
| **Cache** | Multi-backend caching (Redis, in-memory, hybrid, noop), invalidation patterns, factory pattern |
| **Components/UI** | React UI components (Button, Table, Badge, Modal, etc.) with Tailwind CSS |
| **Constants** | Error codes, user messages, pagination defaults, security constants |
| **Error** | Typed `AppError` class, error handler middleware, error display utilities |
| **Geolocation** | GeoIP lookup, batch processing, provider factory (for multiple providers) |
| **Hooks** | React hooks: useDataTable, useDebounce, useExitIntent, useTimezone |
| **Logger** | Winston-based structured logging with daily rotation |
| **Middleware** | Next.js middleware wrappers: auth, rate-limiting, CORS, security headers |
| **Storage** | Cloudflare R2 / AWS S3 compatible storage client |
| **System** | Health check endpoint, CPU/memory/disk/network monitoring |
| **Types** | Shared TypeScript definitions (API, database, env, GeoIP, user, i18n, QR code) |
| **Utils** | 20+ utility functions (sanitizer, validators, CSV export, URL normalizer, IP utils, etc.) |
| **Validators** | Password strength validation with configurable rules |

**Non-Functional Requirements**:
- TypeScript strict mode with full type safety
- >80% code coverage via unit & integration tests
- Vitest test framework with jsdom environment
- ESM-only distribution (no CommonJS)
- Two-stage build: JS (tsup) + type declarations (tsc)
- Subpath exports for granular imports and tree-shaking
- MIT license, published to npm as public package
- Node.js >= 18 support

### 2.2 Out of Scope ❌

- **Database ORM**: Use Prisma directly in consuming projects
- **Form libraries**: Use React Hook Form or similar in consuming projects
- **API clients**: Use fetch or axios directly
- **Internationalization (i18n) implementation**: Provide types only; implementation left to consumers
- **UI component library completeness**: Focus on essential components (Button, Table, Badge); complex components added as needed
- **Real-time features**: WebSocket, Server-Sent Events (may be added in future)
- **Cloud provider abstractions beyond S3/R2**: Focus on S3-compatible APIs only

---

## 3. Functional Requirements

### 3.1 Authentication Module

**FR-AUTH-001**: JWT Token Management
- Sign JWT tokens with custom payload
- Verify and decode JWT tokens
- Support token refresh strategies
- Handle token expiration gracefully

**FR-AUTH-002**: Password Security
- Hash passwords using bcrypt (not plain text)
- Validate password strength (min 8 chars, mixed case, numbers, symbols)
- Support password reset workflows

**FR-AUTH-003**: OAuth Integration Helpers
- Provide utilities to parse OAuth provider responses
- Support multiple OAuth providers (Google, GitHub, etc.)
- Handle OAuth state validation

**FR-AUTH-004**: Prisma Session Adapter
- Store and retrieve user sessions from Prisma database
- Support session expiration and cleanup
- Enable session-based authentication alongside JWT

### 3.2 Cache Module

**FR-CACHE-001**: Multi-Backend Support
- Support Redis backend for distributed caching
- Support in-memory backend for single-instance apps
- Support hybrid approach (memory + Redis fallback)
- Support noop (no-op) backend for testing

**FR-CACHE-002**: Cache Operations
- Get / Set / Delete operations with TTL support
- Pattern-based cache invalidation
- Cache warming and preloading
- Automatic serialization/deserialization (JSON)

**FR-CACHE-003**: Factory Pattern
- Pluggable cache backends via factory function
- Auto-detection based on environment variables
- Sensible defaults for each backend

### 3.3 Error Handling Module

**FR-ERROR-001**: Typed Error Class
- `AppError` class with error code, message, HTTP status
- Error codes from centralized constants (ENUM-like)
- Stack trace and context preservation

**FR-ERROR-002**: Error Handler Middleware
- Centralized error handler for Next.js API routes
- Log errors with structured context
- Return consistent error response format
- Support error recovery strategies (retry, circuit breaker)

**FR-ERROR-003**: Error Display
- Client-side error display utilities
- Translate error codes to user-friendly messages
- Support i18n message lookup

### 3.4 Middleware Module

**FR-MW-001**: Auth Middleware
- Verify JWT or session cookie
- Require or optional authentication
- Attach user context to request

**FR-MW-002**: Rate Limiting
- Token bucket or sliding window rate limiting
- Redis-backed for distributed systems
- Per-IP or per-user rate limits
- Return 429 Too Many Requests on limit exceeded

**FR-MW-003**: CORS Middleware
- Configure allowed origins, methods, headers
- Support credential cookies
- Handle preflight requests

**FR-MW-004**: Security Headers
- Add security headers: CSP, X-Frame-Options, X-Content-Type-Options, etc.
- HSTS support for HTTPS
- Clickjacking protection

### 3.5 Geolocation Module

**FR-GEO-001**: Single IP Lookup
- Query IP geolocation (country, city, lat/long)
- Support multiple provider backends (MaxMind, IP2Location, etc.)
- Cache lookups for performance

**FR-GEO-002**: Batch Processing
- Bulk GeoIP lookup for multiple IPs
- Parallel provider queries
- Deduplication of results

**FR-GEO-003**: Provider Factory
- Pluggable geolocation providers
- Auto-detection based on API keys
- Fallback to secondary provider on failure

### 3.6 Logger Module

**FR-LOG-001**: Structured Logging
- Log to console (dev) and file (prod)
- JSON format for structured parsing
- Log levels: error, warn, info, debug

**FR-LOG-002**: Daily Rotation
- Automatic log file rotation by date
- Preserve logs for configurable days (e.g., 14 days)
- Compression of old log files

**FR-LOG-003**: Context Propagation
- Include request ID, user ID, session ID in logs
- Trace async operations across logs
- Support custom metadata

### 3.7 Storage Module

**FR-STORE-001**: S3-Compatible Upload
- Upload files to Cloudflare R2 (AWS S3-compatible)
- Support presigned URLs for authenticated access
- Automatic content-type detection

**FR-STORE-002**: File Management
- Delete files
- List files with pagination
- Get file metadata (size, MIME type, upload date)

### 3.8 React Components

**FR-COMP-001**: Essential UI Components
- Button, Card, Badge, Modal, Select
- Accessible (WCAG 2.1 AA) and keyboard-navigable
- Tailwind CSS styling with customization

**FR-COMP-002**: Data Display
- Table with sorting, filtering, pagination
- Responsive design (mobile-first)
- Light/dark mode support

### 3.9 React Hooks

**FR-HOOK-001**: useDataTable
- Table state management (sorting, filtering, pagination)
- Handle async data fetching
- Optimistic updates

**FR-HOOK-002**: useDebounce
- Debounce input values with configurable delay
- Support cleanup on unmount

**FR-HOOK-003**: useExitIntent
- Detect user exit intent (mouse leaves viewport)
- Fire callbacks for conversion optimization

**FR-HOOK-004**: useTimezone
- Detect user timezone
- Format dates in user's timezone
- Support timezone switching

### 3.10 Types & Utilities

**FR-TYPE-001**: Shared Types
- API response envelopes (success, error, paginated)
- Database entity types
- Environment variable types (branded for safety)
- GeoIP result types
- User types (ID, email, role, etc.)

**FR-UTIL-001**: Input Validation & Sanitization
- Sanitize HTML input (XSS prevention)
- Validate email, URL, phone formats
- Type guards for runtime validation (Zod)

**FR-UTIL-002**: Data Processing
- CSV export from arrays/objects
- URL normalization (deduplicate params, trailing slashes)
- IP address utilities (IPv4/IPv6 parsing, CIDR matching)
- Number formatting (currency, percentage, thousands separator)

**FR-UTIL-003**: Code Utilities
- Short code generator (base62, random)
- Timezone utilities
- Client-side helpers (local storage, cookies)
- Type guards and assertions

**FR-UTIL-004**: Server Utilities
- API response helpers
- Error processor and formatter
- Optimistic lock for concurrent updates

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-PERF-001**: Bundle Size
- Individual module tree-shaking: importing `@withwiz/toolkit/auth` should not include cache module code
- Gzipped bundle size per module: < 50KB (target)
- No runtime initialization overhead

**NFR-PERF-002**: Runtime Performance
- Cache operations: < 5ms for in-memory, < 50ms for Redis
- Password hashing: configurable work factor, typical 100-300ms
- Middleware latency: < 1ms per middleware stack

### 4.2 Reliability

**NFR-REL-001**: Error Recovery
- Circuit breaker for failing external services (GeoIP, Redis)
- Automatic retry with exponential backoff
- Graceful degradation (e.g., fallback to noop cache)

**NFR-REL-002**: Data Consistency
- Cache invalidation patterns prevent stale data
- Session data persists across restarts
- Error logs include stack traces for debugging

### 4.3 Security

**NFR-SEC-001**: Input Validation
- All user inputs validated/sanitized at module boundaries
- Type-safe with TypeScript strict mode
- Protection against XSS, SQL injection, CSRF

**NFR-SEC-002**: Authentication & Authorization
- JWT tokens use strong algorithms (HS256 minimum, RS256 recommended)
- Session storage in database (Prisma)
- Password hashing with bcrypt (min 10 rounds)
- OAuth state parameter validation

**NFR-SEC-003**: Data Protection
- Sensitive data (tokens, passwords) never logged in plain text
- Secure headers for APIs (CSP, X-Frame-Options, etc.)
- CORS restrictions to trusted origins

### 4.4 Maintainability

**NFR-MAINT-001**: Code Quality
- Strict TypeScript mode enforced
- >80% code coverage (unit + integration tests)
- No external dev dependencies bundled
- Clear module boundaries and exports

**NFR-MAINT-002**: Documentation
- JSDoc comments for all public APIs
- README with quick-start examples
- Module reference in package.json exports
- Inline comments for complex logic

**NFR-MAINT-003**: Versioning
- Semantic versioning (MAJOR.MINOR.PATCH)
- CHANGELOG updated on each release
- Breaking changes documented
- Migration guides for major versions

### 4.5 Compatibility

**NFR-COMPAT-001**: Runtime Support
- Node.js >= 18
- ESM modules only (no CommonJS)
- Browser compatible via Next.js (React Client Components)

**NFR-COMPAT-002**: Framework Support
- Next.js >= 14 (middleware, API routes)
- React >= 18 (hooks, components)
- Prisma integration for sessions

---

## 5. Success Criteria

### 5.1 Functional Success

- ✅ All 14 modules implemented and tested (> 80% coverage)
- ✅ Subpath exports working correctly (tree-shaking verified)
- ✅ Zero critical security vulnerabilities (automated scanning)
- ✅ All APIs documented with JSDoc and README examples

### 5.2 Performance Success

- ✅ Bundle size < 50KB per module (gzipped)
- ✅ Cache operations < 50ms P99 latency
- ✅ Password hashing < 500ms on standard hardware
- ✅ No runtime initialization overhead (< 1ms)

### 5.3 Quality Success

- ✅ Code coverage >= 80% across all modules
- ✅ TypeScript strict mode: 0 implicit any errors
- ✅ Zero high/critical issues in code scanning (SAST)
- ✅ All tests passing in CI/CD pipeline

### 5.4 Adoption Success

- ✅ Published to npm registry (@withwiz/toolkit)
- ✅ Documentation complete (README, API reference, examples)
- ✅ Adopted in >= 2 production withwiz projects
- ✅ Download rate >= 100 downloads/month by end of Q1

### 5.5 Developer Experience

- ✅ Setup time < 5 minutes (npm install)
- ✅ Quick-start examples for each module
- ✅ Clear error messages with recovery suggestions
- ✅ TypeScript autocompletion working (types shipped)

---

## 6. Risks & Mitigation

### 6.1 Risk: Breaking Changes Impact Downstream Projects

**Severity**: High | **Probability**: Medium

**Description**: Changes to public APIs break consuming projects

**Mitigation**:
- Use semantic versioning strictly (MAJOR.MINOR.PATCH)
- Review breaking changes in code review
- Maintain compatibility layer for 2+ minor versions
- Publish migration guides

### 6.2 Risk: Cache Consistency Issues

**Severity**: High | **Probability**: Low

**Description**: Cache invalidation fails, stale data served to users

**Mitigation**:
- Pattern-based invalidation with wildcard support
- Test invalidation in all cache backends
- Add cache-busting strategy (version headers)
- Monitor cache hit rates in production

### 6.3 Risk: Security Vulnerabilities in Dependencies

**Severity**: High | **Probability**: Medium

**Description**: Vulnerable dependencies (jose, bcryptjs, etc.) impact security

**Mitigation**:
- Run npm audit in CI/CD (fail on high/critical)
- Update dependencies monthly
- Monitor security advisories
- Use only well-maintained dependencies

### 6.4 Risk: Over-Engineering, Unused Modules

**Severity**: Medium | **Probability**: Medium

**Description**: Some modules not adopted, maintenance burden increases

**Mitigation**:
- Track adoption metrics per module
- Deprecate low-usage modules in v1.0
- Gather feedback from internal teams
- Keep scope focused on proven patterns

### 6.5 Risk: Performance Degradation at Scale

**Severity**: Medium | **Probability**: Low

**Description**: Caching, logging, middleware cause latency issues under load

**Mitigation**:
- Benchmark with realistic data volumes
- Load test cache backends (Redis, in-memory)
- Profile middleware stack
- Document performance trade-offs

### 6.6 Risk: TypeScript/Build System Issues

**Severity**: Medium | **Probability**: Low

**Description**: Tsup/tsc misconfiguration causes broken builds or incorrect types

**Mitigation**:
- Test build in CI for all node versions (18, 20, 22)
- Verify type declarations with dtslint
- Test subpath imports in consuming projects
- Document build system clearly (CLAUDE.md)

---

## 7. Implementation Timeline

| Phase | Deliverables | Duration | Status |
|-------|--------------|----------|--------|
| **v0.1.0** | Auth, Cache, Error, Logger, Middleware, Types, Utils | ✅ Complete | Released |
| **v0.1.1** | Polish, bug fixes, documentation improvements | ✅ Complete | Released |
| **v0.2.0** | Components/UI, Hooks (useDataTable, useDebounce) | 🔄 In Progress | Q1 2026 |
| **v0.3.0** | Geolocation, Storage (R2), System health check | ⏳ Planned | Q2 2026 |
| **v0.4.0** | Advanced hooks (useExitIntent, useTimezone), validators | ⏳ Planned | Q2 2026 |
| **v1.0.0** | Stable API, production-ready, comprehensive docs | ⏳ Planned | Q3 2026 |

---

## 8. Related Documents

- **README.md**: Quick-start guide and module reference
- **CONTRIBUTING.md**: Development setup and contribution workflow
- **CLAUDE.md**: Developer guidance for Claude Code
- **CHANGELOG.md**: Release notes and breaking changes
- **Design Doc**: [withwiz-toolkit.design.md](../02-design/withwiz-toolkit.design.md) (future)
- **Test Plan**: [withwiz-toolkit.test-plan.md](./withwiz-toolkit.test-plan.md) (future)

---

## 9. Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Manager | withwiz Team | 2026-03-03 | ✅ Approved |
| Engineering Lead | — | — | ⏳ Pending |
| Tech Lead | — | — | ⏳ Pending |

---

## Appendix: Acronyms

- **JWT**: JSON Web Token
- **OAuth**: Open Authorization
- **CORS**: Cross-Origin Resource Sharing
- **CSP**: Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **XSS**: Cross-Site Scripting
- **CSRF**: Cross-Site Request Forgery
- **WCAG**: Web Content Accessibility Guidelines
- **Gzip**: GNU zip compression
- **P99**: 99th percentile latency
- **SAST**: Static Application Security Testing
- **TTL**: Time-To-Live
- **S3**: Amazon Simple Storage Service
- **R2**: Cloudflare R2 (S3-compatible)
- **TDD**: Test-Driven Development
