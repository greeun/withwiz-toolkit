/**
 * batch-processor
 *
 * batch-processor
 * - Shared
 */
import { logger } from '@withwiz/logger/logger';
import type { IBatchProcessorConfig, IBatchProcessResult } from '@withwiz/types/geoip';

/**
 * 범용 배치 처리기
 * 다양한 배치 작업에 재사용 가능한 공통 로직
 */
export class BatchProcessor<T, R> {
  private config: IBatchProcessorConfig;

  constructor(config?: Partial<IBatchProcessorConfig>) {
    this.config = {
      batchSize: 50,
      delayBetweenBatches: 2000,
      maxConcurrentBatches: 3,
      retryAttempts: 3,
      timeout: 10000,
      ...config
    };
  }

  /**
   * 배치 처리 실행
   */
  async processBatch(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<IBatchProcessResult> {
    const result: IBatchProcessResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      processingTime: 0,
      averageTimePerItem: 0
    };

    try {
      logger.info(`Starting batch processing for ${items.length} items`);

      // 배치로 나누어 처리
      for (let i = 0; i < items.length; i += this.config.batchSize) {
        const batch = items.slice(i, i + this.config.batchSize);
        
        try {
          const batchResults = await processor(batch);
          
          result.totalProcessed += batch.length;
          result.successful += batchResults.length;
          
          // 진행률 콜백 호출
          if (onProgress) {
            onProgress(result.totalProcessed, items.length);
          }
          
          // 배치 간 지연
          if (i + this.config.batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
          }
        } catch (error) {
          logger.error(`Batch processing error for batch ${i}-${i + this.config.batchSize}`, { error });
          result.errors.push(`Batch ${i}-${i + this.config.batchSize}: ${error}`);
          result.failed += batch.length;
        }
      }

      logger.info('Batch processing completed', result);
      return result;

    } catch (error) {
      logger.error('Batch processing failed', { error });
      result.errors.push(`Overall error: ${error}`);
      return result;
    }
  }

  /**
   * 재시도 로직이 포함된 배치 처리
   */
  async processBatchWithRetry(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<IBatchProcessResult> {
    const result: IBatchProcessResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      processingTime: 0,
      averageTimePerItem: 0
    };

    try {
      logger.info(`Starting batch processing with retry for ${items.length} items`);

      // 배치로 나누어 처리
      for (let i = 0; i < items.length; i += this.config.batchSize) {
        const batch = items.slice(i, i + this.config.batchSize);
        let batchResults: R[] = [];
        let retryCount = 0;
        
        // 재시도 로직
        while (retryCount < this.config.retryAttempts) {
          try {
            batchResults = await processor(batch);
            break; // 성공하면 루프 종료
          } catch (error) {
            retryCount++;
            logger.warn(`Batch processing attempt ${retryCount} failed for batch ${i}-${i + this.config.batchSize}`, { error });
            
            if (retryCount >= this.config.retryAttempts) {
              throw error; // 최대 재시도 횟수 초과
            }
            
            // 재시도 전 지연
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches * retryCount));
          }
        }
        
        result.totalProcessed += batch.length;
        result.successful += batchResults.length;
        
        // 진행률 콜백 호출
        if (onProgress) {
          onProgress(result.totalProcessed, items.length);
        }
        
        // 배치 간 지연
        if (i + this.config.batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
        }
      }

      logger.info('Batch processing with retry completed', result);
      return result;

    } catch (error) {
      logger.error('Batch processing with retry failed', { error });
      result.errors.push(`Overall error: ${error}`);
      return result;
    }
  }

  /**
   * 동시 배치 처리 (병렬 처리)
   */
  async processBatchConcurrent(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<IBatchProcessResult> {
    const result: IBatchProcessResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      processingTime: 0,
      averageTimePerItem: 0
    };

    try {
      logger.info(`Starting concurrent batch processing for ${items.length} items`);

      // 배치로 나누기
      const batches: T[][] = [];
      for (let i = 0; i < items.length; i += this.config.batchSize) {
        batches.push(items.slice(i, i + this.config.batchSize));
      }

      // 동시 처리할 배치 수만큼 나누기
      const concurrentBatches: T[][][] = [];
      for (let i = 0; i < batches.length; i += this.config.maxConcurrentBatches) {
        concurrentBatches.push(batches.slice(i, i + this.config.maxConcurrentBatches));
      }

      // 각 동시 배치 그룹 처리
      for (const batchGroup of concurrentBatches) {
        const promises = batchGroup.map(async (batch, index) => {
          try {
            const batchResults = await processor(batch);
            return { success: true, results: batchResults, batchIndex: index };
          } catch (error) {
            logger.error(`Concurrent batch processing error for batch ${index}`, { error });
            return { success: false, error, batchIndex: index };
          }
        });

        const batchResults = await Promise.all(promises);

        // 결과 집계
        batchResults.forEach(({ success, results, error, batchIndex }) => {
          const batch = batchGroup[batchIndex];
          result.totalProcessed += batch.length;
          
          if (success && results) {
            result.successful += results.length;
          } else {
            result.failed += batch.length;
            result.errors.push(`Concurrent batch ${batchIndex}: ${error}`);
          }
        });

        // 진행률 콜백 호출
        if (onProgress) {
          onProgress(result.totalProcessed, items.length);
        }

        // 동시 배치 그룹 간 지연
        if (concurrentBatches.indexOf(batchGroup) < concurrentBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
        }
      }

      logger.info('Concurrent batch processing completed', result);
      return result;

    } catch (error) {
      logger.error('Concurrent batch processing failed', { error });
      result.errors.push(`Overall error: ${error}`);
      return result;
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<IBatchProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): IBatchProcessorConfig {
    return { ...this.config };
  }
}

/**
 * 배치 처리기 팩토리 함수
 */
export function createBatchProcessor<T, R>(
  config?: Partial<IBatchProcessorConfig>
): BatchProcessor<T, R> {
  return new BatchProcessor<T, R>(config);
}
