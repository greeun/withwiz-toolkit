/**
 * 모듈 초기화 시 선택 설정 누락 warn 로그 출력
 */
export function configWarn(module: string, message: string): void {
  console.warn(`[${module}] ${message}`);
}
