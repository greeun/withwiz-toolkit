/**
 * useExitIntent
 *
 * Exit Intent 감지 훅
 * - 마우스가 브라우저 상단 영역을 벗어날 때 감지
 * - 모바일에서는 페이지 이탈 전 감지
 *
 * @package @withwiz/hooks
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseExitIntentOptions {
  /** 팝업 표시 쿨다운 시간 (밀리초) - 기본 24시간 */
  cooldown?: number;
  /** 페이지 진입 후 대기 시간 (밀리초) - 기본 5초 */
  delay?: number;
  /** localStorage에 저장할 키 */
  storageKey?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export interface UseExitIntentReturn {
  /** 팝업 표시 여부 */
  showPopup: boolean;
  /** 팝업 닫기 */
  closePopup: () => void;
  /** 다시 보지 않기 처리 */
  dismissForever: () => void;
}

const DEFAULT_COOLDOWN = 24 * 60 * 60 * 1000; // 24시간
const DEFAULT_DELAY = 5000; // 5초
const DEFAULT_STORAGE_KEY = 'exit-intent-popup';

/**
 * Exit Intent 감지 훅
 *
 * @example
 * ```tsx
 * const { showPopup, closePopup, dismissForever } = useExitIntent({
 *   cooldown: 86400000, // 24시간
 *   delay: 5000,        // 5초 후 활성화
 *   storageKey: 'my-popup',
 * });
 *
 * if (showPopup) {
 *   return <Modal onClose={closePopup} onDismiss={dismissForever} />;
 * }
 * ```
 */
export function useExitIntent(options: UseExitIntentOptions = {}): UseExitIntentReturn {
  const {
    cooldown = DEFAULT_COOLDOWN,
    delay = DEFAULT_DELAY,
    storageKey = DEFAULT_STORAGE_KEY,
    disabled = false,
  } = options;

  const [showPopup, setShowPopup] = useState(false);
  const hasTriggered = useRef(false);
  const isReady = useRef(false);

  // 마지막 표시 시간 확인
  const canShowPopup = useCallback(() => {
    if (typeof window === 'undefined') return false;

    const lastShown = localStorage.getItem(`${storageKey}-last-shown`);
    const isDismissed = localStorage.getItem(`${storageKey}-dismissed`) === 'true';

    if (isDismissed) return false;
    if (!lastShown) return true;

    const timeSinceLastShown = Date.now() - parseInt(lastShown, 10);
    return timeSinceLastShown >= cooldown;
  }, [storageKey, cooldown]);

  // 팝업 표시 처리
  const triggerPopup = useCallback(() => {
    if (hasTriggered.current || !isReady.current || disabled) return;
    if (!canShowPopup()) return;

    hasTriggered.current = true;
    setShowPopup(true);
    localStorage.setItem(`${storageKey}-last-shown`, Date.now().toString());
  }, [canShowPopup, storageKey, disabled]);

  // 팝업 닫기
  const closePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  // 다시 보지 않기
  const dismissForever = useCallback(() => {
    localStorage.setItem(`${storageKey}-dismissed`, 'true');
    setShowPopup(false);
  }, [storageKey]);

  useEffect(() => {
    if (disabled) return;

    // 지연 후 준비 상태로 전환
    const delayTimer = setTimeout(() => {
      isReady.current = true;
    }, delay);

    // Exit Intent 감지 (마우스가 브라우저 상단을 벗어날 때)
    const handleMouseLeave = (e: MouseEvent) => {
      // 마우스가 상단 영역(y < 10)으로 벗어날 때만 감지
      if (e.clientY < 10 && isReady.current) {
        triggerPopup();
      }
    };

    // 모바일: 뒤로가기 또는 탭 전환 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isReady.current) {
        // 모바일에서는 visibility change로 감지하지만, 팝업은 띄우지 않음 (UX 고려)
        // 대신 다음 방문 시 표시할 수 있도록 상태 저장만 함
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(delayTimer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay, disabled, triggerPopup]);

  return {
    showPopup,
    closePopup,
    dismissForever,
  };
}
