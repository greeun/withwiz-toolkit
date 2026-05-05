/**
 * Layer 2: Build/Export Integrity Tests
 *
 * npm 패키지 소비자 관점에서 검증:
 * 1. package.json exports의 모든 경로가 dist/에 실제 존재하는가?
 * 2. .d.ts 타입 선언 파일이 빠짐없이 생성되었는가?
 * 3. 번들에 external 의존성이 포함되지 않았는가?
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}
const PKG = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

// ============================================================================
// 1. Export Path Resolution
// ============================================================================

describe('Export Path Integrity', () => {
  const exports = PKG.exports as Record<string, string>;
  const wildcardExports: string[] = [];
  const staticExports: [string, string][] = [];

  for (const [key, value] of Object.entries(exports)) {
    if (key.includes('*')) {
      wildcardExports.push(key);
    } else {
      staticExports.push([key, value]);
    }
  }

  // Known build issues — remove entries once fixed
  const KNOWN_MISSING: string[] = [];

  describe('static exports → dist/ file exists', () => {
    const testableExports = staticExports.filter(
      ([key]) => !KNOWN_MISSING.includes(key),
    );

    it.each(testableExports)('%s → %s', (exportPath, distPath) => {
      const fullPath = resolve(ROOT, distPath);
      expect(
        existsSync(fullPath),
        `Export "${exportPath}" points to "${distPath}" but file does not exist`,
      ).toBe(true);
    });

    if (KNOWN_MISSING.length > 0) {
      it('documents known missing exports (build issues to fix)', () => {
        for (const key of KNOWN_MISSING) {
          const distPath = exports[key];
          const fullPath = resolve(ROOT, distPath);
          if (existsSync(fullPath)) {
            // If it's fixed, remove from KNOWN_MISSING
            throw new Error(`"${key}" is no longer missing — remove from KNOWN_MISSING`);
          }
        }
      });
    }
  });

  describe('wildcard exports → base directory exists', () => {
    for (const pattern of wildcardExports) {
      const distPattern = exports[pattern];
      it(`${pattern} base dir exists`, () => {
        // Extract the directory portion before the wildcard
        const baseDir = distPattern.split('*')[0];
        const fullDir = resolve(ROOT, baseDir);
        expect(
          existsSync(fullDir),
          `Wildcard export "${pattern}" base directory does not exist: ${fullDir}`,
        ).toBe(true);
      });
    }
  });
});

// ============================================================================
// 2. Type Declaration (.d.ts) Integrity
// ============================================================================

describe('Type Declaration Integrity', () => {
  const exports = PKG.exports as Record<string, string>;

  const staticExports = Object.entries(exports).filter(
    ([key]) => !key.includes('*'),
  );

  describe('every .js export has a corresponding .d.ts', () => {
    it.each(staticExports)('%s has .d.ts', (exportPath, distPath) => {
      const dtsPath = distPath.replace(/\.js$/, '.d.ts');
      const fullPath = resolve(ROOT, dtsPath);
      expect(
        existsSync(fullPath),
        `Export "${exportPath}": missing type declaration at "${dtsPath}"`,
      ).toBe(true);
    });
  });

  it('no .js file in dist/ lacks a .d.ts counterpart', () => {
    const jsFiles = findFiles(DIST, /\.js$/)
      .map((f) => f.replace(ROOT + '/', ''))
      .filter((f) => !f.includes('chunk-') && !f.includes('world_countries'));

    const missing: string[] = [];
    for (const js of jsFiles) {
      const dts = js.replace(/\.js$/, '.d.ts');
      if (!existsSync(resolve(ROOT, dts))) {
        missing.push(js);
      }
    }

    expect(
      missing,
      `These .js files have no .d.ts:\n${missing.join('\n')}`,
    ).toHaveLength(0);
  });
});

// ============================================================================
// 3. Bundle Contamination Check
// ============================================================================

describe('Bundle Contamination Check', () => {
  const EXTERNAL_DEPS = [
    'react',
    'react-dom',
    'next',
    '@prisma/client',
    'bcryptjs',
    'jose',
    '@upstash/redis',
    '@aws-sdk/client-s3',
    'winston',
    'winston-daily-rotate-file',
    'zod',
    'nodemailer',
  ];

  it('dist/ total size is reasonable (< 20MB excluding world map)', () => {
    const allFiles = findFiles(DIST, /\.js$/).map((f) => f.replace(ROOT + '/', ''));
    let totalSize = 0;
    for (const f of allFiles) {
      if (f.includes('world_countries')) continue;
      totalSize += statSync(resolve(ROOT, f)).size;
    }
    const totalMB = totalSize / 1024 / 1024;
    expect(totalMB).toBeLessThan(5);
  });

  it('no external dependency source code bundled in main exports', () => {
    const mainFiles = [
      'dist/auth/index.js',
      'dist/cache/index.js',
      'dist/error/index.js',
      'dist/middleware/index.js',
      'dist/utils/index.js',
    ];

    for (const file of mainFiles) {
      const fullPath = resolve(ROOT, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');

      for (const dep of EXTERNAL_DEPS) {
        // External deps should appear as imports, not inlined code
        // Check for large inlined content (> 500 chars without import)
        const depRegex = new RegExp(`from\\s+['"]${dep.replace('/', '\\/')}['"]`);
        const hasImport = depRegex.test(content);
        if (!hasImport) {
          // If no import reference, the dep shouldn't appear as substantial code
          const inlineCheck = new RegExp(`${dep.replace('/', '\\/')}`, 'g');
          const matches = content.match(inlineCheck);
          // A few references (type annotations, comments) are ok, but not dozens
          expect(
            (matches?.length || 0) < 20,
            `${file} may have bundled "${dep}" (${matches?.length} references)`,
          ).toBe(true);
        }
      }
    }
  });

  it('chunk files do not exceed 100KB individually (except world map)', () => {
    const chunks = findFiles(DIST, /^chunk-.*\.js$/).map((f) => f.replace(ROOT + '/', ''));
    const oversized: string[] = [];

    for (const chunk of chunks) {
      if (chunk.includes('world_countries')) continue;
      const size = statSync(resolve(ROOT, chunk)).size;
      if (size > 100 * 1024) {
        oversized.push(`${chunk} (${(size / 1024).toFixed(1)}KB)`);
      }
    }

    expect(
      oversized,
      `Oversized chunks (may indicate accidental bundling):\n${oversized.join('\n')}`,
    ).toHaveLength(0);
  });
});

// ============================================================================
// 4. Package Metadata Consistency
// ============================================================================

describe('Package Metadata Consistency', () => {
  it('package.json has name and version', () => {
    expect(PKG.name).toBe('@withwiz/toolkit');
    expect(PKG.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('all peer dependencies are declared', () => {
    expect(PKG.peerDependencies).toHaveProperty('next');
    expect(PKG.peerDependencies).toHaveProperty('react');
    expect(PKG.peerDependencies).toHaveProperty('react-dom');
  });

  it('no devDependency is also in dependencies', () => {
    const deps = Object.keys(PKG.dependencies || {});
    const devDeps = Object.keys(PKG.devDependencies || {});
    const overlap = deps.filter((d) => devDeps.includes(d));
    expect(
      overlap,
      `These packages are in both dependencies and devDependencies: ${overlap.join(', ')}`,
    ).toHaveLength(0);
  });

  it('exports do not reference src/ directly', () => {
    const exports = PKG.exports as Record<string, string>;
    const srcRefs = Object.entries(exports).filter(([, v]) => v.includes('src/'));
    expect(
      srcRefs.map(([k]) => k),
      'These exports point to src/ instead of dist/',
    ).toHaveLength(0);
  });

  it('build output uses ESM format (.js files contain export/import)', () => {
    const sampleFile = resolve(DIST, 'auth/index.js');
    if (existsSync(sampleFile)) {
      const content = readFileSync(sampleFile, 'utf-8');
      expect(content).toMatch(/export\s|import\s/);
    }
  });
});
