import { describe, it, expect } from 'vitest';
import { buildOpenApiSpec } from '../../../src/next/oapi/openapi-spec';

describe('buildOpenApiSpec', () => {
  it('X-API-Key securityScheme 자동 주입', () => {
    const spec: any = buildOpenApiSpec({ info: { title: 'T', version: '1' }, paths: {} });
    expect(spec.components.securitySchemes.ApiKeyAuth).toEqual({ type: 'apiKey', in: 'header', name: 'X-API-Key' });
    expect(spec.openapi).toMatch(/^3\./);
  });
  it('전달한 paths 보존', () => {
    const spec: any = buildOpenApiSpec({ info: { title: 'T', version: '1' }, paths: { '/x': { get: {} } } });
    expect(spec.paths['/x']).toBeDefined();
  });
});
