/**
 * Base Transport
 *
 * 모든 Transport의 기본 클래스
 */

import type { ITransport, ILogEntry } from '@withwiz/error/logging/types';

/**
 * BaseTransport 추상 클래스
 */
export abstract class BaseTransport implements ITransport {
  public readonly name: string;
  protected enabled: boolean;

  constructor(name: string, enabled: boolean = true) {
    this.name = name;
    this.enabled = enabled;
  }

  /**
   * 로그 전송 (구현 필요)
   */
  abstract log(entry: ILogEntry): Promise<void>;

  /**
   * Transport 활성화 여부
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Transport 활성화
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Transport 비활성화
   */
  disable(): void {
    this.enabled = false;
  }
}
