/**
 * LoadingState 컴포넌트
 *
 * 로딩 상태 표시
 */

'use client';

import React from 'react';
import type { TLocale } from '@withwiz/error/messages';

export interface ILoadingStateProps {
  /** 로딩 메시지 */
  message?: string;

  /** 로케일 (기본값: 'ko') */
  locale?: TLocale;

  /** 크기 */
  size?: 'sm' | 'md' | 'lg';

  /** 전체 화면 로딩 여부 */
  fullScreen?: boolean;

  /** 스피너 타입 */
  variant?: 'spinner' | 'dots' | 'pulse';
}

/**
 * 크기별 스타일
 */
const sizeStyles = {
  sm: {
    spinner: 'h-4 w-4 border-2',
    text: 'text-sm',
    dots: 'h-2 w-2',
  },
  md: {
    spinner: 'h-8 w-8 border-2',
    text: 'text-base',
    dots: 'h-3 w-3',
  },
  lg: {
    spinner: 'h-12 w-12 border-4',
    text: 'text-lg',
    dots: 'h-4 w-4',
  },
};

/**
 * LoadingState 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 로딩
 * <LoadingState />
 *
 * // 커스텀 메시지
 * <LoadingState message="데이터를 불러오는 중..." />
 *
 * // 전체 화면 로딩
 * <LoadingState fullScreen message="처리 중..." />
 *
 * // Dots 애니메이션
 * <LoadingState variant="dots" />
 * ```
 */
export function LoadingState({
  message,
  locale = 'ko',
  size = 'md',
  fullScreen = false,
  variant = 'spinner',
}: ILoadingStateProps) {
  const defaultMessage = locale === 'ko' ? '로딩 중...' : 'Loading...';
  const displayMessage = message || defaultMessage;
  const styles = sizeStyles[size];

  const renderSpinner = () => (
    <div
      className={`${styles.spinner} animate-spin rounded-full border-blue-600 border-t-transparent`}
      role="status"
      aria-label="loading"
    />
  );

  const renderDots = () => (
    <div className="flex space-x-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${styles.dots} animate-bounce rounded-full bg-blue-600`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <div className="flex space-x-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${styles.dots} animate-pulse rounded-full bg-blue-600`}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );

  const renderLoadingAnimation = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  const content = (
    <div className="flex flex-col items-center justify-center space-y-4">
      {renderLoadingAnimation()}
      <p className={`${styles.text} text-gray-600`}>{displayMessage}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-12">{content}</div>;
}
