/**
 * 요청 초기화 미들웨어
 *
 * - requestId 생성
 * - locale 감지
 * - startTime 설정
 */

import { randomUUID } from 'crypto';
import type { TApiMiddleware } from './types';
import { LocaleDetector } from '@withwiz/error/core/locale-detector';

/**
 * 요청 초기화 미들웨어
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain()
 *   .use(initRequestMiddleware);
 * ```
 */
export const initRequestMiddleware: TApiMiddleware = async (
  context,
  next
) => {
  // requestId 생성 (없는 경우에만)
  if (!context.requestId) {
    context.requestId = randomUUID();
  }

  // locale 감지 (없는 경우에만)
  if (!context.locale) {
    context.locale = LocaleDetector.detectServer(context.request);
  }

  // startTime 설정 (없는 경우에만)
  if (!context.startTime) {
    context.startTime = Date.now();
  }

  // metadata 초기화 (없는 경우에만)
  if (!context.metadata) {
    context.metadata = {};
  }

  return await next();
};
