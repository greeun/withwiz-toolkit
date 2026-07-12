/**
 * startup-banner tests
 *
 * Test Scope:
 * - mask: url(host만)/secret(앞 4글자)/default(앞 20글자)/미설정
 * - status / feature / modeLabel 표시 규칙
 * - printStartupBanner: 헤더·섹션·라벨 패딩·Ready 라인 출력 형태
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  c,
  mask,
  status,
  feature,
  modeLabel,
  printStartupBanner,
} from '../../../src/core/utils/startup-banner';

const strip = (s: string) => s.replace(/\x1b\[[0-9]+m/g, '');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('c', () => {
  it('색상 코드로 감싼다', () => {
    expect(c('green', 'ok')).toBe('\x1b[32mok\x1b[0m');
  });
});

describe('mask', () => {
  it('미설정 값은 ✗ NOT_SET', () => {
    expect(strip(mask(undefined))).toBe('✗ NOT_SET');
    expect(strip(mask(''))).toBe('✗ NOT_SET');
  });

  it('url: host만 노출', () => {
    expect(strip(mask('postgresql://user:pw@db.example.com:5432/app', 'url'))).toBe(
      '✓ db.example.com:5432'
    );
  });

  it('url 파싱 실패: 15자 초과면 절단', () => {
    expect(mask('not a url but quite long value', 'url')).toBe('not a url but q...');
  });

  it('secret: 앞 4글자 + ***', () => {
    expect(strip(mask('supersecretvalue', 'secret'))).toBe('✓ supe***');
  });

  it('default: 20자 초과 절단', () => {
    expect(strip(mask('a'.repeat(25)))).toBe(`✓ ${'a'.repeat(20)}...`);
    expect(strip(mask('short'))).toBe('✓ short');
  });
});

describe('status / feature / modeLabel', () => {
  it('status: ✓ / ✗', () => {
    expect(strip(status(true))).toBe('✓');
    expect(strip(status(false))).toBe('✗');
  });

  it('feature: ✓ / ⚠ OFF', () => {
    expect(strip(feature(true))).toBe('✓');
    expect(strip(feature(false))).toBe('⚠ OFF');
  });

  it('modeLabel: production/test/기본', () => {
    expect(strip(modeLabel('production'))).toBe('PRODUCTION');
    expect(strip(modeLabel('test'))).toBe('TEST');
    expect(strip(modeLabel('development'))).toBe('DEVELOPMENT');
    expect(strip(modeLabel(undefined))).toBe('DEVELOPMENT');
  });
});

describe('printStartupBanner', () => {
  it('헤더(제목+버전)·섹션·라인·Ready 를 출력한다', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printStartupBanner({
      title: '🚀 Test Service',
      version: '1.2.3',
      sections: [
        { emoji: '⚙️', title: 'Env', lines: [['Mode', 'DEV'], ['Node', 'v20']] },
      ],
    });

    const out = spy.mock.calls.map((args) => strip(String(args[0]))).join('\n');
    expect(out).toContain('🚀 Test Service v1.2.3');
    expect(out).toContain('⚙️ Env');
    expect(out).toContain('━'.repeat(50));
    expect(out).toMatch(/Mode\s+DEV/);
    expect(out).toMatch(/✓ Ready at /);
  });

  it('version 미지정이면 버전 표기가 없다', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printStartupBanner({ title: 'T', sections: [] });
    const out = spy.mock.calls.map((args) => strip(String(args[0]))).join('\n');
    expect(out).toContain('T');
    expect(out).not.toContain(' v');
  });

  it('labelWidth 만큼 라벨을 패딩한다', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printStartupBanner({
      title: 'T',
      sections: [{ emoji: 'x', title: 'S', lines: [['A', 'B']] }],
      labelWidth: 10,
    });
    const out = spy.mock.calls.map((args) => strip(String(args[0]))).join('\n');
    expect(out).toContain(`  ${'A'.padEnd(10)} B`);
  });
});
