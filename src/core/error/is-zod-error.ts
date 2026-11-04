/** zod 3·4 가 공통으로 갖는 실패 정보. */
export interface ZodLikeError {
  name: string;
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string; code?: string }>;
}

/**
 * zod 실패 판정. `instanceof` 를 쓰지 않는다 — 소비 앱과 toolkit 이 서로 다른 zod 사본을 쓰면(특히 3·4 혼재)
 * 앱이 던진 검증 실패를 toolkit 이 알아보지 못해 400 이 500 으로 바뀐다.
 */
export function isZodError(error: unknown): error is ZodLikeError {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { name?: unknown; issues?: unknown };
  return e.name === 'ZodError' && Array.isArray(e.issues);
}

/** issue 의 path 를 점 표기로 만든다. zod 4 의 path 는 symbol 을 포함할 수 있어 그대로 join 하면 던진다. */
export function zodPathText(path: ReadonlyArray<PropertyKey>): string {
  return path.map(String).join('.');
}
