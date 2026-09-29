/**
 * 순수 Node ESM 소비 가능 범위 검증
 *
 * `next/*` 서브패스는 Next.js 라우트·미들웨어 전용이며 `next/server` 를 확장자 없이 import 한다.
 * `next` 패키지에는 `exports` 필드가 없어 순수 Node ESM 은 이 경로를 해석하지 못하지만,
 * Next.js 번들러는 `next/server` 를 런타임(edge·node)별 구현으로 연결하므로 그대로 둔다.
 *
 * 대신 `next/*` 밖의 서브패스(core·prisma·initialize 등)는 Next.js 없이 순수 Node ESM 에서
 * import 되어야 한다. 이 테스트는 그 경계가 깨지는 것(예: core 가 next/server 를 끌어옴)을 막는다.
 * vitest 는 자체 해석기를 쓰므로 별도 `node` 프로세스에서 패키지 자기 이름으로 import 한다.
 * 전제: `npm run build` 선행.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

function nonNextSubpaths(): string[] {
  const { exports } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    exports: Record<string, unknown>;
  };
  return Object.keys(exports).filter(
    (key) =>
      key !== './package.json' &&
      !key.includes('*') &&
      !key.endsWith('.css') &&
      !key.startsWith('./next'),
  );
}

beforeAll(() => {
  if (!existsSync(resolve(ROOT, 'dist/initialize.js'))) {
    throw new Error('dist/initialize.js 없음 — 먼저 `npm run build` 실행 필요');
  }
});

describe('순수 Node ESM 소비', () => {
  it('next/* 밖의 모든 서브패스를 Next.js 없이 import 할 수 있다', () => {
    const subpaths = nonNextSubpaths();
    const specifiers = subpaths.map((key) => (key === '.' ? '@withwiz/toolkit' : `@withwiz/toolkit${key.slice(1)}`));
    const script = `
      const failures = [];
      for (const specifier of ${JSON.stringify(specifiers)}) {
        try { await import(specifier); }
        catch (error) { failures.push(specifier + ': ' + (error.code ?? error.message)); }
      }
      process.stdout.write(JSON.stringify(failures));
    `;

    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    expect(subpaths.length).toBeGreaterThan(100);
    expect(JSON.parse(output.trim().split('\n').pop()!)).toEqual([]);
  });
});
