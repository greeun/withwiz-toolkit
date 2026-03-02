/**
 * EmptyState 컴포넌트
 *
 * 데이터가 없는 상태 표시
 */

'use client';

import React from 'react';
import type { TLocale } from '@withwiz/error/messages';

export interface IEmptyStateProps {
  /** 제목 */
  title?: string;

  /** 설명 */
  description?: string;

  /** 로케일 (기본값: 'ko') */
  locale?: TLocale;

  /** 아이콘 (이모지 또는 SVG) */
  icon?: string | React.ReactNode;

  /** 액션 버튼 텍스트 */
  actionText?: string;

  /** 액션 핸들러 */
  onAction?: () => void;

  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 크기별 스타일
 */
const sizeStyles = {
  sm: {
    container: 'py-8',
    icon: 'text-4xl',
    title: 'text-base',
    description: 'text-sm',
  },
  md: {
    container: 'py-12',
    icon: 'text-6xl',
    title: 'text-lg',
    description: 'text-base',
  },
  lg: {
    container: 'py-16',
    icon: 'text-8xl',
    title: 'text-xl',
    description: 'text-lg',
  },
};

/**
 * EmptyState 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 빈 상태
 * <EmptyState
 *   title="데이터가 없습니다"
 *   description="아직 등록된 항목이 없습니다."
 * />
 *
 * // 액션 버튼 포함
 * <EmptyState
 *   title="링크가 없습니다"
 *   description="첫 번째 링크를 생성해보세요."
 *   actionText="링크 생성"
 *   onAction={() => router.push('/create')}
 * />
 *
 * // 커스텀 아이콘
 * <EmptyState
 *   icon="📭"
 *   title="받은 메일함이 비어있습니다"
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  locale = 'ko',
  icon = '📦',
  actionText,
  onAction,
  size = 'md',
}: IEmptyStateProps) {
  const defaultTitle = locale === 'ko' ? '데이터가 없습니다' : 'No data available';
  const defaultDescription =
    locale === 'ko'
      ? '아직 등록된 항목이 없습니다.'
      : 'No items have been registered yet.';

  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;
  const styles = sizeStyles[size];

  const renderIcon = () => {
    if (typeof icon === 'string') {
      return (
        <span className={`${styles.icon}`} role="img" aria-label="empty-icon">
          {icon}
        </span>
      );
    }
    return icon;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${styles.container}`}
    >
      {/* 아이콘 */}
      <div className="mb-4 text-gray-400">{renderIcon()}</div>

      {/* 제목 */}
      <h3 className={`${styles.title} font-semibold text-gray-900`}>
        {displayTitle}
      </h3>

      {/* 설명 */}
      <p className={`${styles.description} mt-2 text-gray-500`}>
        {displayDescription}
      </p>

      {/* 액션 버튼 */}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
