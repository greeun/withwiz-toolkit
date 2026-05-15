/**
 * Layer 2: Tier Import Rule Tests
 *
 * docs/FRAMEWORK_TIERS.md 의 티어 규칙을 소스 레벨에서 강제:
 * - react 티어는 next 를 import 할 수 없다 (next 미설치 소비자 보호)
 *
 * peerDependenciesMeta 로 next 가 optional 인 0.7 모델에서,
 * react 티어가 next 에 의존하면 next 미설치 소비자의 번들/런타임이 깨진다.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');
const REACT_TIER = resolve(ROOT, 'src/react');

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// `from 'next'`, `from "next/dynamic"`, `import('next/...')` 형태를 모두 탐지
const NEXT_IMPORT =
  /\bfrom\s+['"]next(\/[^'"]*)?['"]|\bimport\(\s*['"]next(\/[^'"]*)?['"]\s*\)/;

describe('티어 import 규칙', () => {
  it('react 티어는 next 를 import 하지 않는다', () => {
    const offenders = findSourceFiles(REACT_TIER)
      .filter((file) => NEXT_IMPORT.test(readFileSync(file, 'utf-8')))
      .map((file) => file.slice(ROOT.length + 1));

    expect(offenders).toEqual([]);
  });
});
