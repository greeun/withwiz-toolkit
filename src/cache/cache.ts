/**
 * Cache Module - Backward Compatibility Re-export
 *
 * 이 파일은 기존 import 경로 호환성을 위해 유지됩니다.
 * 모든 내용은 index.ts에서 re-export됩니다.
 *
 * @example
 * // 기존 방식 (계속 동작)
 * import { cache, withCache } from '@withwiz/cache/cache';
 *
 * // 신규 권장 방식
 * import { cache, withCache } from '@withwiz/cache';
 */

export * from './index';
