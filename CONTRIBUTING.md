# Contributing to @withwiz/toolkit

Thank you for your interest in contributing to @withwiz/toolkit! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation

```bash
git clone <repository-url>
cd withwiz-toolkit
npm install
```

## Development Workflow

### Building

```bash
# Build both JS and types
npm run build

# Build only JS
npm run build:js

# Build only types
npm run build:types
```

### Testing

```bash
# Run all tests once
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

### Test Structure

Tests are organized to mirror the source structure:

```
__tests__/
├── unit/
│   ├── auth/
│   ├── cache/
│   ├── error/
│   ├── utils/
│   ├── validators/
│   ├── geolocation/
│   ├── middleware/
│   ├── components/
│   ├── hooks/
│   └── system/
├── integration/
├── setup.ts
└── docs/
```

**Test File Naming:** `<module>.test.ts` or `<module>.test.tsx` for React components

### Coding Standards

#### TypeScript
- Use strict mode
- Add proper type annotations
- Use branded types for sensitive data (IDs, tokens)
- Write JSDoc comments for public APIs

#### Testing (TDD)
- Write tests before implementation
- Aim for >80% code coverage
- Test behavior, not implementation
- Use meaningful test descriptions

Example:
```typescript
describe('PasswordValidator', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('short')
    expect(result.isValid).toBe(false)
  })
})
```

#### Exports
- Use `index.ts` files for module exports
- Export only public APIs
- Keep internal utilities in `core/` subdirectories

### Git Workflow

1. Create feature branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature
   ```

2. Commit messages (conventional):
   ```
   feat: Add new authentication module
   fix: Resolve cache invalidation bug
   docs: Update API documentation
   test: Add tests for password validator
   chore: Update dependencies
   ```

3. Push and create PR against `develop` branch

### Release Process

Releases follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes

Update `CHANGELOG.md` and version in `package.json` when releasing.

## Code Review

All PRs require:
- ✅ Tests passing (`npm test`)
- ✅ Coverage maintained (>80%)
- ✅ TypeScript compilation (`npm run build:types`)
- ✅ Code review approval

## Reporting Issues

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment (Node version, OS, etc.)
- Relevant code snippets

## Questions?

- Check existing issues and discussions
- Review documentation in `/docs`
- Check README.md for common patterns

Thank you for contributing! 🎉
