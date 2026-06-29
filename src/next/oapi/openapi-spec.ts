export interface OpenApiInput {
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, unknown>;
  schemas?: Record<string, unknown>;
}

/**
 * OpenAPI 3.0.3 스펙 골격 빌더. X-API-Key securityScheme(ApiKeyAuth)을 자동 주입하고
 * 전역 security를 ApiKeyAuth로 설정한다. paths/schemas는 호출측이 주입.
 */
export function buildOpenApiSpec(input: OpenApiInput): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: input.info,
    servers: input.servers ?? [],
    paths: input.paths,
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: input.schemas ?? {},
    },
    security: [{ ApiKeyAuth: [] }],
  };
}
