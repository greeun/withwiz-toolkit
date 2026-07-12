/**
 * startup-banner — 공용 서버 구동 배너
 *
 * 모든 withwiz 서버 프로젝트에서 서버 구동 시 환경설정을 동일한 형식으로 출력한다.
 * 외부 의존성 없음(순수 console) — Core tier.
 *
 * 사용 예:
 *   import { printStartupBanner, mask, status } from '@withwiz/toolkit/core/utils/startup-banner';
 *   printStartupBanner({
 *     title: '🚀 My Service',
 *     version: process.env.npm_package_version,
 *     sections: [
 *       { emoji: '⚙️', title: 'Environment', lines: [
 *         ['Mode', process.env.NODE_ENV ?? 'development'],
 *         ['Base URL', mask(process.env.BASE_URL, 'url')],
 *       ]},
 *     ],
 *   });
 */

// ANSI 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const;

type Color = keyof typeof colors;

export const c = (color: Color, text: string) => `${colors[color]}${text}${colors.reset}`;

/** 민감/긴 값을 마스킹해 표시. url=host만, secret=앞 4글자, default=앞 20글자. */
export function mask(value: string | undefined, type: 'url' | 'secret' | 'default' = 'default') {
  if (!value) return c('red', '✗ NOT_SET');
  switch (type) {
    case 'url':
      try {
        const url = new URL(value);
        return c('green', `✓ ${url.host}`);
      } catch {
        return value.length > 15 ? value.substring(0, 15) + '...' : value;
      }
    case 'secret':
      return c('green', `✓ ${value.substring(0, 4)}***`);
    default:
      return c('green', `✓ ${value.length > 20 ? value.substring(0, 20) + '...' : value}`);
  }
}

/** 불리언 상태를 ✓/✗ 로 표시. */
export function status(condition: boolean) {
  return condition ? c('green', '✓') : c('red', '✗');
}

/** 기능 플래그 표시: 켜짐 ✓, 꺼짐 ⚠ OFF. */
export function feature(condition: boolean) {
  return condition ? status(true) : c('yellow', '⚠ OFF');
}

/** NODE_ENV 를 색상 라벨로. production=노랑, test=시안, 그 외=초록(DEVELOPMENT). */
export function modeLabel(nodeEnv: string | undefined) {
  const mode = nodeEnv || 'development';
  if (mode === 'production') return c('yellow', 'PRODUCTION');
  if (mode === 'test') return c('cyan', 'TEST');
  return c('green', 'DEVELOPMENT');
}

export type BannerLine = [label: string, value: string];
export interface BannerSection {
  emoji: string;
  title: string;
  lines: BannerLine[];
}
export interface StartupBannerOptions {
  title: string;
  version?: string;
  sections: BannerSection[];
  width?: number; // 구분선 길이 (기본 50)
  labelWidth?: number; // 라벨 패딩 폭 (기본 28)
  locale?: string; // Ready 시각 로케일 (기본 ko-KR)
  timeZone?: string; // Ready 시각 타임존 (기본 Asia/Seoul)
}

/** 서버 구동 배너 출력 (런타임에 실제 로드된 값 사용). */
export function printStartupBanner(opts: StartupBannerOptions): void {
  const {
    title,
    version,
    sections,
    width = 50,
    labelWidth = 28,
    locale = 'ko-KR',
    timeZone = 'Asia/Seoul',
  } = opts;

  const bar = c('cyan', '━'.repeat(width));
  console.log(`\n${bar}`);
  console.log(`${c('bright', title)}${version ? ' ' + c('dim', `v${version}`) : ''}`);
  console.log(bar);

  for (const s of sections) {
    console.log(`\n${s.emoji} ${c('bright', s.title)}`);
    for (const [label, value] of s.lines) {
      console.log(`  ${c('dim', label.padEnd(labelWidth))} ${value}`);
    }
  }

  console.log(`\n${bar}`);
  const time = new Date().toLocaleTimeString(locale, { timeZone });
  console.log(`${c('green', '✓')} Ready at ${time}`);
  console.log(`${bar}\n`);
}
