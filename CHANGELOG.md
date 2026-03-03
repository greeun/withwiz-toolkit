# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-03-03

### Added
- New cache environment configuration module (`cache/cache-env.ts`)
- Batch processor for geolocation operations (`geolocation/batch-processor.ts`)
- Enhanced provider support for geolocation services
- Additional type exports for better TypeScript integration
- Comprehensive package.json exports for subpath imports

### Changed
- Updated package structure with additional entry points
- Improved cache manager factory pattern
- Enhanced error recovery mechanisms

### Fixed
- Cache invalidation edge cases
- Error handler response formatting

### Documentation
- Added test plan and progress tracking
- Enhanced README files in modules
- Improved API documentation

## [0.1.0] - 2025-02-XX

### Initial Release

#### Core Features
- **Authentication** (`auth/`)
  - JWT token management
  - Password hashing (bcryptjs)
  - OAuth2 support
  - Prisma adapter for user persistence
  - Email token generation

- **Caching** (`cache/`)
  - Multiple cache backends (In-memory, Redis, Hybrid, Noop)
  - Cache invalidation strategies
  - Factory pattern for cache manager selection
  - LRU cache with size limits

- **Error Handling** (`error/`)
  - Centralized error management
  - Recovery strategies (retry, circuit-breaker, degradation)
  - Multi-language error messages (EN, KO)
  - Error logging with Winston
  - Error display components for React

- **Geolocation** (`geolocation/`)
  - Multi-provider support (IP-API, ipapi.co, MaxMind, IPGeolocation)
  - Batch processing for bulk lookups
  - Geographic data aggregation

- **Utilities** (`utils/`)
  - Input sanitization
  - URL normalization
  - CSV export
  - IP utilities
  - Type guards
  - Timezone handling
  - Short code generation
  - QR code generation (client-side)

- **React Components** (`components/ui/`)
  - Data table with sorting and filtering
  - Pagination component
  - Badge, Button, Alert, Tooltip
  - Loading bar and skeletons
  - Timezone and domain displays
  - World map chart

- **React Hooks** (`hooks/`)
  - `useDataTable` - Table state management
  - `useDebounce` - Debounced values
  - `useExitIntent` - Detect user exit intent
  - `useTimezone` - Timezone detection

- **Next.js Middleware** (`middleware/`)
  - Authentication middleware
  - Rate limiting
  - CORS handling
  - Security headers
  - Request initialization
  - Error handling
  - Response logging
  - Middleware composition

- **Storage** (`storage/`)
  - Cloudflare R2 (S3-compatible) integration
  - File upload and retrieval

- **System Monitoring** (`system/`)
  - Health checks
  - CPU, Memory, Disk monitoring
  - Network diagnostics
  - Environment detection

- **Validators** (`validators/`)
  - Password strength validation

- **Logging** (`logger/`)
  - Winston-based structured logging

### Technical Details
- **TypeScript** v5 with strict mode
- **Build**: tsup (ESM) + tsc (type declarations)
- **Testing**: vitest with >80% coverage
- **Package**: Public npm package (@withwiz/toolkit)
- **Peer Dependencies**: Next.js 15, React 18+

---

## Release Guidelines

### Version Bumping
```bash
# Patch (0.1.1 -> 0.1.2)
npm version patch

# Minor (0.1.0 -> 0.2.0)
npm version minor

# Major (0.1.0 -> 1.0.0)
npm version major
```

### Pre-Release
```bash
# Alpha: 0.1.0-alpha.0
npm version prerelease --preid=alpha
```

### Publishing
```bash
npm publish
```
