/**
 * useTimezone
 *
 * useTimezone 훅
 * - 커스텀 React 훅
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserTimezone, getTimezoneOffset } from '@withwiz/utils/timezone';

interface ITimezoneInfo {
  timezone: string;
  offset: number;
  offsetFormatted: string;
}

/**
 * 사용자 타임존 정보를 관리하는 Hook
 */
export function useTimezone() {
  const [timezoneInfo, setTimezoneInfo] = useState<ITimezoneInfo>({
    timezone: 'UTC',
    offset: 0,
    offsetFormatted: '+00:00'
  });

  const [isLoading, setIsLoading] = useState(true);

  // 타임존 정보 초기화
  useEffect(() => {
    try {
      const timezone = getUserTimezone();
      const offset = getTimezoneOffset();
      const offsetFormatted = formatOffset(offset);
      
      setTimezoneInfo({
        timezone,
        offset,
        offsetFormatted
      });
    } catch (error) {
      console.warn('Cannot get timezone information:', error);
      // 기본값 사용
      setTimezoneInfo({
        timezone: 'UTC',
        offset: 0,
        offsetFormatted: '+00:00'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 오프셋을 포맷팅 (예: +09:00, -05:00)
  const formatOffset = useCallback((offsetMinutes: number): string => {
    const absOffset = Math.abs(offsetMinutes);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    const sign = offsetMinutes <= 0 ? '+' : '-';

    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }, []);

  // 타임존 정보 새로고침
  const refreshTimezone = useCallback(() => {
    try {
      const timezone = getUserTimezone();
      const offset = getTimezoneOffset();
      const offsetFormatted = formatOffset(offset);
      
      setTimezoneInfo({
        timezone,
        offset,
        offsetFormatted
      });
    } catch (error) {
      console.error('Failed to refresh timezone information:', error);
    }
  }, [formatOffset]);

  return {
    ...timezoneInfo,
    isLoading,
    refreshTimezone
  };
}

/**
 * 타임존 정보를 간단하게 표시하는 Hook
 */
export function useSimpleTimezone() {
  const { timezone, offsetFormatted, isLoading } = useTimezone();
  
  return {
    timezone,
    offsetFormatted,
    isLoading,
    // 간단한 표시용
    display: `${timezone} (${offsetFormatted})`
  };
}
