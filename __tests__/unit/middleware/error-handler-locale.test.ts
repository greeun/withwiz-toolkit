/**
 * Unit Tests: errorHandlerMiddleware - 요청 로케일별 userMessage
 *
 * 래퍼가 요청(NEXT_LOCALE 쿠키·Accept-Language)으로 감지한 locale 이
 * 오류 봉투의 userMessage 까지 전달되는지 검증합니다.
 */

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
}));

import { AppError } from '@withwiz/toolkit/core/error/app-error';
import { errorHandlerMiddleware } from '@withwiz/toolkit/next/middleware/error-handler';
import { LocaleDetector } from '@withwiz/toolkit/next/error/locale-detector';
import { getErrorMessage, type TLocale } from '@withwiz/toolkit/core/error/messages';

function createMockRequest(options: { cookies?: Record<string, string>; acceptLanguage?: string }) {
  const headers = new Headers();
  if (options.acceptLanguage) headers.set('accept-language', options.acceptLanguage);
  return {
    method: 'GET',
    url: 'http://localhost/api/test',
    headers,
    cookies: {
      get: (name: string) =>
        options.cookies?.[name] !== undefined ? { value: options.cookies[name] } : undefined,
    },
    nextUrl: new URL('http://localhost/api/test'),
  } as any;
}

async function envelopeFor(locale: TLocale) {
  const context = {
    request: createMockRequest({}),
    locale,
    requestId: 'req-1',
    startTime: Date.now(),
    metadata: {},
  };
  const response = await errorHandlerMiddleware(context as any, async () => {
    throw AppError.validation();
  });
  return (await response.json()) as { error: { code: number; userMessage: { title: string } } };
}

describe('errorHandlerMiddleware userMessage locale', () => {
  it.each(['ko', 'en', 'ja'] as const)('%s 로케일 사전의 문구를 쓴다', async (locale) => {
    const body = await envelopeFor(locale);
    expect(body.error.userMessage.title).toBe(getErrorMessage(body.error.code, locale).title);
  });

  it('NEXT_LOCALE=ja 요청이면 일본어 문구를 돌려준다', async () => {
    const request = createMockRequest({ cookies: { NEXT_LOCALE: 'ja' } });
    const body = await envelopeFor(LocaleDetector.detectServer(request));
    expect(body.error.userMessage.title).toBe('入力内容をご確認ください');
  });

  it('Accept-Language: en 요청이면 영어 문구를 돌려준다', async () => {
    const request = createMockRequest({ acceptLanguage: 'en-US,en;q=0.9' });
    const body = await envelopeFor(LocaleDetector.detectServer(request));
    expect(body.error.userMessage.title).toBe('Please check your input');
  });
});
