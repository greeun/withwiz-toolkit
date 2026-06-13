/**
 * CORS Credential Reflection (C-1)
 *
 * 감사(harness Evaluator) High 발견:
 * - utils/cors.ts setCorsHeaders: origin 부재 시 `ACAO: *` + 무조건
 *   `Allow-Credentials: true` (브라우저 무효 + 의도 노출).
 * - utils/cors.ts isOriginAllowed: dev 에서 `origin.includes('localhost')`
 *   → `https://localhost.attacker.com` 통과(substring 우회).
 * - middleware/cors.ts: allowedOrigins 에 '*' 포함 시 `ACAO: *` 와
 *   `Allow-Credentials: true` 동시 설정.
 *
 * 계약: 자격증명(`Allow-Credentials: true`)은 절대 `ACAO: *` 와 함께
 * 설정되지 않으며, Origin 은 정확 일치 시에만 반사한다. localhost 는
 * substring 이 아닌 정확 호스트로만 허용한다.
 */
import { NextResponse } from 'next/server';
import {
  setCorsHeaders,
  isOriginAllowed,
  initCorsConfig,
} from '@withwiz/toolkit/next/utils/cors';
import { createCorsMiddleware } from '@withwiz/toolkit/next/middleware/cors';

function reqWith(origin?: string, method = 'GET') {
  const headers = new Headers();
  if (origin !== undefined) headers.set('origin', origin);
  return { method, headers } as any;
}

const ALLOWED = 'https://app.example.com';

describe('C-1: CORS credential reflection — utils/cors.ts', () => {
  beforeEach(() => {
    initCorsConfig({ isDevelopment: true, additionalOrigins: [ALLOWED] });
  });

  it('never pairs Access-Control-Allow-Origin:* with Allow-Credentials:true (no Origin header)', () => {
    const res = setCorsHeaders(NextResponse.json({}), reqWith(undefined));
    const acao = res.headers.get('access-control-allow-origin');
    const creds = res.headers.get('access-control-allow-credentials');
    expect(!(acao === '*' && creds === 'true')).toBe(true);
  });

  it('rejects a substring-localhost attacker origin in dev', () => {
    expect(isOriginAllowed('https://localhost.attacker.com')).toBe(false);
  });

  it('still allows an exact localhost origin in dev (back-compat)', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
  });

  it('reflects an allow-listed origin exactly, with credentials', () => {
    const res = setCorsHeaders(NextResponse.json({}), reqWith(ALLOWED));
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

describe('C-1: CORS credential reflection — middleware/cors.ts', () => {
  it('never pairs ACAO:* with Allow-Credentials:true when allowedOrigins includes "*"', async () => {
    const mw = createCorsMiddleware({ allowedOrigins: ['*'], allowCredentials: true });
    const res = await mw(
      { request: reqWith('https://anything.example') } as any,
      async () => NextResponse.json({}),
    );
    const acao = res.headers.get('access-control-allow-origin');
    const creds = res.headers.get('access-control-allow-credentials');
    expect(!(acao === '*' && creds === 'true')).toBe(true);
  });

  it('reflects an exact allow-listed origin with credentials (back-compat)', async () => {
    const mw = createCorsMiddleware({ allowedOrigins: [ALLOWED], allowCredentials: true });
    const res = await mw(
      { request: reqWith(ALLOWED) } as any,
      async () => NextResponse.json({}),
    );
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
