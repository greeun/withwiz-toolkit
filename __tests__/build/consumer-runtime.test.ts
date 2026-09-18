/**
 * E2E(소비자 여정): 빌드 산출물(dist)을 런타임 import해 전체 플로우 실행
 *
 * exports-integrity(정적 존재 검사)와 달리 dist 코드가 실제로 실행되는지 검증 —
 * ESM 문법 오류·chunk 참조 파손·alias 잔재는 존재 검사로 못 잡는다.
 * 전제: `npm run build` 선행 (dist 부재 시 명확한 실패 메시지).
 *
 * 테스트 범위 (e2e-gap-testcases.md):
 * - TC-E2E-AK-001: dist errors.js 런타임 import + typed error 동작
 * - TC-E2E-AK-002: dist ApiKeyService 소비자 전체 여정 (발급→인증→회전→구키 무효)
 * - TC-E-002: dist Prisma 오류 분류 소비자 여정 (매핑표·classifyError·process·processError·handlePrismaError)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const DIST = resolve(__dirname, '../../dist');
const distUrl = (rel: string) => pathToFileURL(resolve(DIST, rel)).href;

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'core/api-key/errors.js'))) {
    throw new Error('dist/core/api-key/errors.js 없음 — 먼저 `npm run build` 실행 필요');
  }
});

describe('dist 소비자 런타임 검증', () => {
  it('TC-E2E-AK-001: dist errors.js import — ApiKeyError/isApiKeyError 동작', async () => {
    const mod = await import(distUrl('core/api-key/errors.js'));
    const err = new mod.ApiKeyError('API key not found', mod.API_KEY_ERROR_CODES.NOT_FOUND);
    expect(err).toBeInstanceOf(Error);
    expect(mod.isApiKeyError(err, mod.API_KEY_ERROR_CODES.NOT_FOUND)).toBe(true);
    expect(mod.isApiKeyError(new Error('x'))).toBe(false);
  });

  it('TC-E2E-AK-002: dist ApiKeyService 전체 여정 — 발급→인증→회전→구키 무효', async () => {
    const [svcMod, errMod] = await Promise.all([
      import(distUrl('core/api-key/api-key.service.js')),
      import(distUrl('core/api-key/errors.js')),
    ]);

    // 소비자 관점 fake 저장소 (dist 코드만 실행)
    const records = new Map<string, Record<string, unknown>>();
    let seq = 0;
    const user = { id: 'u1', email: 'a@b.c', isActive: true, plan: 'PRO' };
    const deps = {
      repo: {
        create: async (d: Record<string, unknown>) => {
          const rec = { ...d, id: `key-${++seq}`, description: d.description ?? null,
            endpointLimits: d.endpointLimits ?? null, isActive: true, usageCount: 0,
            lastUsedAt: null, lastUsedIp: null, createdAt: new Date(), updatedAt: new Date() };
          records.set(rec.id as string, rec);
          return rec;
        },
        findByHash: async (h: string) => {
          const rec = [...records.values()].find((r) => r.key === h);
          return rec ? { ...rec, user } : null;
        },
        findById: async (id: string) => records.get(id) ?? null,
        findMany: async () => ({ items: [], total: 0 }),
        countActive: async () => [...records.values()].filter((r) => r.isActive).length,
        update: async () => { throw new Error('unused'); },
        deactivate: async (id: string) => {
          records.set(id, { ...records.get(id)!, isActive: false });
        },
        delete: async () => {},
        incrementUsage: async () => {},
      },
      cache: { getValidation: async () => null, setValidation: async () => {}, invalidate: async () => {} },
      planConfig: { getApiKeyLimit: async () => 5, getRateLimit: async () => 100 },
      usage: { canMakeApiCall: async () => ({ allowed: true, current: { daily: 0, monthly: 0 }, limit: { daily: 1, monthly: 1 } }) },
      env: { prefixProd: 'sk_live_', prefixDev: 'sk_test_', defaultExpiryDays: 365, restrictedPlans: ['FREEMIUM'] },
    };

    const svc = new svcMod.ApiKeyService(deps);
    const first = await svc.generateApiKey('u1', { name: 'e2e', permissions: ['read'], environment: 'production' }, 'PRO');
    expect(first.key.startsWith('sk_live_')).toBe(true);
    expect((await svc.validateApiKey(first.key)).valid).toBe(true);

    const rotated = await svc.regenerateApiKey('u1', first.id, 'PRO');
    expect((await svc.validateApiKey(rotated.key)).valid).toBe(true);
    const oldCheck = await svc.validateApiKey(first.key);
    expect(oldCheck.valid, '회전 후 구키가 계속 인증됨').toBe(false);

    // typed error가 dist 경계에서도 판별 가능
    const err = await svc.getApiKey('missing', 'u1').then(() => null, (e: unknown) => e);
    expect(errMod.isApiKeyError(err, errMod.API_KEY_ERROR_CODES.NOT_FOUND)).toBe(true);
  });

  describe('TC-E-002: dist Prisma 오류 분류 소비자 여정', () => {
    /** Prisma 7 오류를 이름과 code 속성으로 모사한다 (dist 코드는 클래스 import 없이 판정). */
    const prismaKnown = (code: string, message = 'Invalid invocation') =>
      Object.assign(new Error(message), { name: 'PrismaClientKnownRequestError', code });
    const prismaValidation = () =>
      Object.assign(new Error('Argument `email` is missing. unauthorized'), { name: 'PrismaClientValidationError' });

    it('dist prisma-error.js — code 속성 판정, 매핑표 P2011·메시지 스캔 한도', async () => {
      const mod = await import(distUrl('core/error/prisma-error.js'));
      const info = mod.inspectPrismaError(prismaKnown('P2002', 'x'.repeat(4000)));

      expect(info).toMatchObject({ code: 'P2002', source: 'property' });
      expect(mod.PRISMA_ERROR_MAP.P2011.status).toBe(400);
      expect(mod.PRISMA_MESSAGE_SCAN_LIMIT).toBe(200);
    });

    it('dist error-codes.js — classifyError 가 Prisma 검증 오류를 400 으로 분류 (401 아님)', async () => {
      const mod = await import(distUrl('core/constants/error-codes.js'));

      expect(mod.classifyError(prismaValidation()).status).toBe(400);
    });

    it('dist error-processor.js — ErrorProcessor.process 가 P2025 를 404 와 prismaCode 로 변환', async () => {
      const mod = await import(distUrl('next/utils/error-processor.js'));
      const result = mod.ErrorProcessor.process(prismaKnown('P2025', 'Operation failed'));

      expect(result.status).toBe(404);
      expect(result.details).toEqual({ prismaCode: 'P2025' });
    });

    it('dist error-handler.js — processError 가 P2002 를 409 (40905) 로 변환', async () => {
      const mod = await import(distUrl('next/error/error-handler.js'));
      const result = mod.processError(prismaKnown('P2002', 'x'.repeat(4000)));

      expect(result.status).toBe(409);
      expect(result.code).toBe(40905);
    });

    it('dist error-processor.js — handlePrismaError 가 매핑표를 따른다 (P2011 400, P2003 400)', async () => {
      const [procMod, mapMod] = await Promise.all([
        import(distUrl('next/utils/error-processor.js')),
        import(distUrl('core/error/prisma-error.js')),
      ]);

      for (const prismaCode of ['P2011', 'P2003']) {
        const response = procMod.handlePrismaError(prismaKnown(prismaCode));
        const body = await response.json();
        const mapping = mapMod.PRISMA_ERROR_MAP[prismaCode];

        expect(response.status, `${prismaCode} 상태 코드`).toBe(mapping.status);
        expect(body).toEqual({ success: false, error: { code: mapping.code, message: mapping.message } });
      }
    });
  });
});
