/**
 * 서버 전용 진입점의 import 그래프 검증 (0.21)
 *
 * 인증 핸들러·오류 빌더는 Next.js 서버 라우트(react-server 조건)에서 불러온다. 여기에 React 클라이언트
 * 컴포넌트(ErrorBoundary — react 의 Component, lucide-react, next/link)가 끌려 들어오면 라우트 번들이 깨진다.
 * `next/error` 묶음(index)은 ErrorBoundary 를 함께 내보내므로, 서버 진입점은 그 묶음을 거치면 안 된다.
 *
 * 일반 Node 는 `next/server` 를 해석하지 못해 런타임으로 불러볼 수 없으므로(pure-node-esm.test.ts 참고),
 * dist 의 상대 import 를 따라가며 정적으로 검사한다. 전제: `npm run build` 선행.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

const DIST = resolve(__dirname, '../../dist');
const CLIENT_ONLY = [/from\s*["']react["']/, /from\s*["']lucide-react["']/, /from\s*["']next\/link["']/];

function importGraph(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:import|export)[^"']*["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = resolve(dirname(file), match[1]);
      if (existsSync(target)) stack.push(target);
    }
  }
  return [...seen];
}

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'next/auth-handlers/index.js'))) {
    throw new Error('dist 없음 — 먼저 `npm run build` 실행 필요');
  }
});

describe('서버 진입점은 클라이언트 전용 의존성을 끌어오지 않는다', () => {
  it.each([
    'next/auth-handlers/index.js',
    'next/auth-handlers/signup.handler.js',
    'next/error/build-error-response.js',
    'next/error/with-standard-errors.js',
  ])('%s', (entry) => {
    const offenders = importGraph(resolve(DIST, entry)).filter((file) =>
      CLIENT_ONLY.some((pattern) => pattern.test(readFileSync(file, 'utf8'))),
    );
    expect(offenders.map((f) => f.slice(DIST.length + 1))).toEqual([]);
  });
});
