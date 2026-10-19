/**
 * safe-fetch.ts 유닛 테스트
 *
 * SSRF 방어의 핵심 두 경로를 검증한다.
 *  1) DNS 해석 결과가 사설 IP를 가리키는 우회 차단 (공개 도메인 → 내부 A레코드)
 *  2) 리다이렉트가 내부 주소로 향하는 우회 차단 (3xx follow 재검증)
 *
 * isSSRFSafe/isInternalIP는 실제 구현을 사용하고, DNS lookup과 fetch만 mock한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from 'node:dns/promises';

vi.mock('node:dns/promises', () => {
  const lookup = vi.fn();
  return { lookup, default: { lookup } };
});

import { safeFetch, SSRFBlockedError } from '@withwiz/toolkit/core/security/safe-fetch';

const mockLookup = vi.mocked(lookup);

/** 공인 IP로 해석되도록 설정 */
function resolvePublic() {
  mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
}

describe('safeFetch — SSRF 방어', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLookup.mockReset();
  });

  it('문자열 검사에서 내부 IP는 fetch 전에 차단한다', async () => {
    resolvePublic();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(safeFetch('http://127.0.0.1/')).rejects.toBeInstanceOf(SSRFBlockedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('DNS가 사설 IP로 해석되면 차단한다 (A레코드 우회)', async () => {
    // 공개처럼 보이는 도메인이 사설 IP로 해석되는 경우
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(safeFetch('http://public-looking.example/')).rejects.toBeInstanceOf(
      SSRFBlockedError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('클라우드 메타데이터 IP로 해석되면 차단한다', async () => {
    mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
    await expect(safeFetch('http://meta.example/')).rejects.toBeInstanceOf(SSRFBlockedError);
  });

  it('리다이렉트가 내부 주소로 향하면 차단한다', async () => {
    resolvePublic();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      }),
    );

    await expect(safeFetch('http://start.example/')).rejects.toBeInstanceOf(SSRFBlockedError);
    // 첫 홉은 fetch되지만, 리다이렉트 대상은 재검증에서 차단되어 두 번째 fetch는 없어야 한다.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('정상 공개 URL은 응답을 반환한다', async () => {
    resolvePublic();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<title>OK</title>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const res = await safeFetch('https://example.com/');
    expect(res.status).toBe(200);
  });

  it('공개→공개 리다이렉트는 최종 응답까지 따라간다', async () => {
    resolvePublic();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://final.example/page' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<title>Final</title>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      );

    const res = await safeFetch('https://start.example/');
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('리다이렉트가 과도하면 차단한다', async () => {
    resolvePublic();
    // 항상 자기 자신으로 리다이렉트
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://loop.example/next' },
      }),
    );

    await expect(safeFetch('https://loop.example/')).rejects.toBeInstanceOf(SSRFBlockedError);
  });

  it('차단 사유 코드를 에러에 담는다', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
    await expect(safeFetch('http://public-looking.example/')).rejects.toMatchObject({
      code: 'RESOLVES_TO_PRIVATE_IP',
      message: '내부 네트워크 주소로 해석되는 호스트입니다',
    });

    await expect(safeFetch('http://127.0.0.1/')).rejects.toMatchObject({ code: 'PRIVATE_IP' });
  });

  it('locale·maxRedirects 옵션을 따른다', async () => {
    resolvePublic();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://loop.example/next' } }),
    );

    await expect(safeFetch('https://loop.example/', {}, { locale: 'en', maxRedirects: 1 })).rejects.toMatchObject({
      code: 'TOO_MANY_REDIRECTS',
      message: 'Too many redirects',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
