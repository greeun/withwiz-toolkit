/**
 * useErrorHandler Hook
 *
 * 에러 상태 관리 및 처리
 */

'use client';

import { useState, useCallback } from 'react';
import { AppError } from '@withwiz/error/app-error';
import { ERROR_CODES } from '@withwiz/constants/error-codes';
import type { TLocale } from '@withwiz/error/messages';
import type { IErrorDisplay } from '@withwiz/error/friendly-messages-v2';
import { getErrorDisplayInfo } from '@withwiz/error/friendly-messages-v2';

/**
 * 에러 상태
 */
export interface IErrorState {
  /** 에러 발생 여부 */
  hasError: boolean;

  /** 에러 코드 */
  code?: number;

  /** 에러 메시지 */
  message?: string;

  /** 에러 표시 정보 */
  displayInfo?: IErrorDisplay;

  /** 에러 발생 시간 */
  timestamp?: number;
}

/**
 * useErrorHandler Hook 반환 타입
 */
export interface IUseErrorHandler {
  /** 에러 상태 */
  errorState: IErrorState;

  /** 에러 처리 */
  handleError: (error: unknown) => void;

  /** 에러 초기화 */
  clearError: () => void;

  /** 인증 에러 처리 (자동 리다이렉트) */
  handleAuthError: (error: unknown, redirectUrl?: string) => void;

  /** 에러 여부 확인 */
  hasError: boolean;
}

/**
 * useErrorHandler Hook
 *
 * @param locale - 로케일 (기본값: 'ko')
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { errorState, handleError, clearError } = useErrorHandler('ko');
 *
 *   const fetchData = async () => {
 *     try {
 *       const res = await fetch('/api/data');
 *       if (!res.ok) {
 *         throw new AppError(40401);
 *       }
 *     } catch (error) {
 *       handleError(error);
 *     }
 *   };
 *
 *   if (errorState.hasError) {
 *     return <ErrorAlert code={errorState.code!} />;
 *   }
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useErrorHandler(locale: TLocale = 'ko'): IUseErrorHandler {
  const [errorState, setErrorState] = useState<IErrorState>({
    hasError: false,
  });

  /**
   * 에러 처리
   */
  const handleError = useCallback(
    (error: unknown) => {
      console.error('[useErrorHandler] Error occurred:', error);

      // AppError인 경우
      if (error instanceof AppError) {
        const displayInfo = getErrorDisplayInfo(error.code, locale);

        setErrorState({
          hasError: true,
          code: error.code,
          message: error.message,
          displayInfo,
          timestamp: Date.now(),
        });
        return;
      }

      // API 응답 에러 (JSON 형식)
      if (
        error &&
        typeof error === 'object' &&
        'error' in error &&
        typeof (error as any).error === 'object'
      ) {
        const apiError = (error as any).error;
        const code = apiError.code || ERROR_CODES.INTERNAL_SERVER_ERROR.code;
        const displayInfo = getErrorDisplayInfo(code, locale);

        setErrorState({
          hasError: true,
          code,
          message: apiError.message || 'Unknown error',
          displayInfo,
          timestamp: Date.now(),
        });
        return;
      }

      // 일반 Error 객체
      if (error instanceof Error) {
        const displayInfo = getErrorDisplayInfo(
          ERROR_CODES.INTERNAL_SERVER_ERROR.code,
          locale
        );

        setErrorState({
          hasError: true,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
          message: error.message,
          displayInfo,
          timestamp: Date.now(),
        });
        return;
      }

      // 알 수 없는 에러
      const displayInfo = getErrorDisplayInfo(
        ERROR_CODES.INTERNAL_SERVER_ERROR.code,
        locale
      );

      setErrorState({
        hasError: true,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
        message: String(error),
        displayInfo,
        timestamp: Date.now(),
      });
    },
    [locale]
  );

  /**
   * 에러 초기화
   */
  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
    });
  }, []);

  /**
   * 인증 에러 처리 (자동 리다이렉트)
   */
  const handleAuthError = useCallback(
    (error: unknown, redirectUrl: string = '/login') => {
      handleError(error);

      // 인증 에러인 경우 리다이렉트
      if (error instanceof AppError) {
        const httpStatus = Math.floor(error.code / 100);
        if (httpStatus === 401 || httpStatus === 403) {
          // 1초 후 리다이렉트
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
        }
      }
    },
    [handleError]
  );

  return {
    errorState,
    handleError,
    clearError,
    handleAuthError,
    hasError: errorState.hasError,
  };
}
