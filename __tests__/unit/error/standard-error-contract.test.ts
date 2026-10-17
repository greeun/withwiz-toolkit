import { readApiError } from '@withwiz/toolkit/core/error/read-api-error';
import { buildErrorBody, buildErrorResponse } from '@withwiz/toolkit/next/error/build-error-response';
import { withStandardErrors, toStandardErrorBody } from '@withwiz/toolkit/next/error/with-standard-errors';
import { ERROR_CODES } from '@withwiz/toolkit/core/constants/error-codes';

describe('readApiError', () => {
  it('표준 응답: key·code·userMessage·fieldErrors·requestId 를 읽는다', () => {
    const r = readApiError({
      success: false,
      error: {
        code: 40305, key: 'EMAIL_NOT_VERIFIED', message: 'dev',
        userMessage: { description: '이메일 인증이 필요합니다' }, requestId: 'req-1',
        details: { fieldErrors: { email: ['확인 필요', '둘째'] } },
      },
    });
    expect(r).toEqual({ key: 'EMAIL_NOT_VERIFIED', code: 40305, text: '이메일 인증이 필요합니다', fieldErrors: { email: '확인 필요' }, requestId: 'req-1' });
  });

  it('표준 응답에 userMessage 가 없으면 message 를 문구로 쓴다', () => {
    expect(readApiError({ error: { code: 40002, message: 'Bad request' } }).text).toBe('Bad request');
  });

  it('문자열형 응답: error 를 문구로, code 를 key 로 읽는다', () => {
    const r = readApiError({ success: false, error: 'Invalid input', code: 'VALIDATION_ERROR', details: { fieldErrors: { password: ['too short'] } } });
    expect(r).toEqual({ key: 'VALIDATION_ERROR', text: 'Invalid input', fieldErrors: { password: 'too short' } });
  });

  it.each([null, 'html', [], { success: false }])('형태를 알 수 없으면 빈 문구를 돌려준다 (%s)', (body) => {
    expect(readApiError(body)).toEqual(expect.objectContaining({ text: '', fieldErrors: {} }));
  });
});

describe('buildErrorBody / buildErrorResponse', () => {
  it('ERROR_CODES 의 key 로 code·status·message·사전 문구를 채운다', () => {
    const { status, body } = buildErrorBody('EMAIL_NOT_VERIFIED', { locale: 'ko' });
    expect(status).toBe(403);
    expect(body.error.code).toBe(ERROR_CODES.EMAIL_NOT_VERIFIED.code);
    expect(body.error.key).toBe('EMAIL_NOT_VERIFIED');
    expect(body.error.message).toBe(ERROR_CODES.EMAIL_NOT_VERIFIED.message);
    expect(body.error.userMessage.description).toEqual(expect.any(String));
    expect(body.error.userMessage.description.length).toBeGreaterThan(0);
  });

  it('사용자 문구와 필드 오류를 덮어쓰고, 상태를 지정할 수 있다', () => {
    const { status, body } = buildErrorBody('PASSWORD_TOO_WEAK', {
      userMessage: '문자 3종 이상', fieldErrors: { password: ['문자 3종 이상'] }, status: 400,
    });
    expect(status).toBe(400);
    expect(body.error.userMessage.description).toBe('문자 3종 이상');
    expect(body.error.details).toEqual({ fieldErrors: { password: ['문자 3종 이상'] } });
  });

  it('ERROR_CODES 에 없는 key 는 상태별 대표 코드를 쓰고 key 는 그대로 둔다', () => {
    const { status, body } = buildErrorBody('AUTH_RATE_LIMITED', { status: 429 });
    expect(status).toBe(429);
    expect(body.error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED.code);
    expect(body.error.key).toBe('AUTH_RATE_LIMITED');
  });

  it('응답에 상태와 헤더를 싣는다', async () => {
    const res = buildErrorResponse('ACCOUNT_LOCKED', { headers: { 'retry-after': '60' } });
    expect(res.status).toBe(403);
    expect(res.headers.get('retry-after')).toBe('60');
    expect((await res.json()).error.key).toBe('ACCOUNT_LOCKED');
  });

  it('로케일에 따라 사전 문구가 달라진다', () => {
    const ko = buildErrorBody('INVALID_CREDENTIALS', { locale: 'ko' }).body.error.userMessage.description;
    const en = buildErrorBody('INVALID_CREDENTIALS', { locale: 'en' }).body.error.userMessage.description;
    expect(ko).not.toBe(en);
  });
});

describe('toStandardErrorBody / withStandardErrors', () => {
  it('문자열형 본문을 표준으로 바꾼다 — code 는 key, error 는 message 와 description', () => {
    const body = toStandardErrorBody(403, { success: false, error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
    expect(body?.error).toEqual(expect.objectContaining({
      key: 'EMAIL_NOT_VERIFIED', code: ERROR_CODES.EMAIL_NOT_VERIFIED.code, message: 'Email not verified',
    }));
    expect(body?.error.userMessage.description).toBe('Email not verified');
  });

  it('code 가 없으면 상태별 대표 key 를 쓰고, details.fieldErrors 를 옮긴다', () => {
    const body = toStandardErrorBody(400, { error: 'Invalid input', details: { formErrors: [], fieldErrors: { email: ['bad'] } } });
    expect(body?.error.key).toBe('BAD_REQUEST');
    expect(body?.error.details).toEqual({ fieldErrors: { email: ['bad'] } });
  });

  it('문자열형이 아니면 null', () => {
    expect(toStandardErrorBody(400, { error: { code: 40002 } })).toBeNull();
    expect(toStandardErrorBody(400, null)).toBeNull();
  });

  it('래퍼는 실패 응답만 바꾸고 상태·헤더를 보존한다', async () => {
    const handler = withStandardErrors(async () => new Response(JSON.stringify({ success: false, error: 'Locked', code: 'ACCOUNT_LOCKED' }), {
      status: 429, headers: { 'content-type': 'application/json', 'retry-after': '30', 'set-cookie': 'a=1' },
    }));
    const res = await handler(new Request('http://x/api/auth/login'));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(res.headers.get('set-cookie')).toBe('a=1');
    const json = await res.json();
    expect(json.error.key).toBe('ACCOUNT_LOCKED');
    expect(json.error.userMessage.description).toBe('Locked');
  });

  it('성공·이미 표준·JSON 아닌 응답은 그대로 통과한다', async () => {
    const ok = new Response('{"success":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    const std = new Response(JSON.stringify({ success: false, error: { code: 40002, key: 'BAD_REQUEST' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    const html = new Response('<html/>', { status: 502, headers: { 'content-type': 'text/html' } });
    for (const original of [ok, std, html]) {
      const res = await withStandardErrors(async () => original)(new Request('http://x'));
      expect(res).toBe(original);
    }
  });
});

describe('기존 응답 생성부의 표준 필드 (0.21)', () => {
  it('errorToResponse 는 key 와 userMessage 를 싣는다', async () => {
    const { errorToResponse } = await import('@withwiz/toolkit/next/error/error-handler');
    const { AppError } = await import('@withwiz/toolkit/core/error/app-error');
    const json = await errorToResponse(AppError.emailNotVerified()).json();
    expect(json.error.key).toBe('EMAIL_NOT_VERIFIED');
    expect(json.error.userMessage.description).toEqual(expect.any(String));
  });

  it('미들웨어는 key 를 싣고, zod 오류는 details.fieldErrors 로도 준다', async () => {
    const { errorHandlerMiddleware } = await import('@withwiz/toolkit/next/middleware/error-handler');
    const { z } = await import('zod');
    const zodError = z.object({ email: z.string().email() }).safeParse({ email: 'x' }).error!;
    const context = { locale: 'en', requestId: 'r-1' } as any;
    const res = await errorHandlerMiddleware(context, async () => { throw zodError; });
    const json = await (res as Response).json();
    expect(json.error.key).toBe('VALIDATION_ERROR');
    expect(json.error.details.fieldErrors.email).toEqual([expect.any(String)]);
    expect(json.error.metadata.issues).toBeDefined();
  });
});
