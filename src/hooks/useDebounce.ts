/**
 * useDebounce
 *
 * useDebounce 훅
 * - 커스텀 React 훅
 */
import { useEffect, useState, useRef } from 'react';

/**
 * 디바운싱을 위한 커스텀 훅
 * @param value 디바운싱할 값
 * @param delay 지연 시간 (밀리초)
 * @returns 디바운싱된 값
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<T>(value);

  useEffect(() => {
    // 값이 실제로 변경되었는지 확인
    if (value === lastValueRef.current) {
      return;
    }
    
    lastValueRef.current = value;
    
    // 이전 타이머가 있다면 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 새로운 타이머 설정
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 클린업 함수
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
} 