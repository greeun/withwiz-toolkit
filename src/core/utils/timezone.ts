/**
 * 글로벌 서비스를 위한 타임존 유틸리티
 * 데이터베이스: UTC 저장
 * 프론트엔드: 사용자 로컬 타임존 표시
 */

/**
 * 현재 시간을 UTC로 반환 (데이터베이스 저장용)
 */
export function getCurrentUTC(): Date {
  return new Date();
}

/**
 * UTC 시간을 사용자 로컬 타임존으로 변환
 */
export function utcToLocal(utcDate: Date | string, timezone?: string): Date {
  const date = new Date(utcDate);

  if (timezone) {
    // 특정 타임존으로 변환
    return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  }

  // 사용자 브라우저 로컬 타임존으로 변환
  return date;
}

/**
 * 사용자 로컬 시간을 UTC로 변환 (데이터베이스 저장용)
 */
export function localToUTC(localDate: Date | string): Date {
  const date = new Date(localDate);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
}

/**
 * 시간을 사용자 친화적인 형식으로 포맷팅 (로컬 타임존 기준)
 */
export function formatUserFriendlyDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = new Date(date);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    hour12: false,
    ...options,
  };

  return dateObj.toLocaleDateString(undefined, defaultOptions);
}

/**
 * 간단한 날짜 포맷 (YYYY-MM-DD)
 */
export function formatSimpleDate(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 간단한 시간 포맷 (HH:MM:SS)
 */
export function formatSimpleTime(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * 전체 날짜 시간 포맷 (YYYY-MM-DD HH:MM:SS)
 */
export function formatFullDateTime(date: Date | string): string {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = dateObj.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${dateStr} ${timeStr}`;
}

/**
 * 테이블용 날짜 시간 포맷 (2줄 표시)
 */
export function formatTableDateTime(date: Date | string): {
  date: string;
  time: string;
} {
  const dateObj = new Date(date);
  return {
    date: dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: dateObj.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

/**
 * Relative time display (e.g., "3h ago", "3d ago")
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInSeconds = Math.floor(
    (now.getTime() - targetDate.getTime()) / 1000,
  );

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

/**
 * 타임존 정보 가져오기
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * 타임존 오프셋 가져오기 (분 단위)
 */
export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * UTC 시간을 ISO 문자열로 변환 (API 응답용)
 */
export function toUTCISOString(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toISOString();
}
