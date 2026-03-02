/**
 * Optimistic Locking Utility
 *
 * 다중 인스턴스 환경에서 동시 업데이트 충돌을 감지하기 위한 낙관적 락 유틸리티.
 * Prisma의 updateMany + where version 조건을 활용.
 */

import { AppError } from '@withwiz/error/app-error';

/**
 * 낙관적 락이 적용된 업데이트 실행
 *
 * @param updateFn - Prisma updateMany를 실행하는 함수. count를 반환해야 함.
 * @param entityName - 엔티티 이름 (에러 메시지용)
 * @throws AppError 40901 (Conflict) - 버전 충돌 시
 *
 * @example
 * ```typescript
 * await withOptimisticLock(
 *   () => prisma.link.updateMany({
 *     where: { id: linkId, version: currentVersion },
 *     data: { title: newTitle, version: { increment: 1 } },
 *   }),
 *   'Link'
 * );
 * ```
 */
export async function withOptimisticLock(
  updateFn: () => Promise<{ count: number }>,
  entityName: string = 'Record'
): Promise<void> {
  const result = await updateFn();

  if (result.count === 0) {
    throw new AppError(40904, `${entityName} was modified by another request. Please retry.`);
  }
}
