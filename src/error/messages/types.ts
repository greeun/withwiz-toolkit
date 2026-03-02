/**
 * 에러 메시지 타입 정의
 */

/**
 * 에러 메시지 인터페이스
 */
export interface IErrorMessage {
  /** 에러 제목 (짧고 명확하게) */
  title: string;
  /** 에러 설명 (상세 내용) */
  description: string;
  /** 사용자 행동 유도 (선택적) */
  action?: string;
}

/**
 * 지원 언어 타입
 */
export type TLocale = 'ko' | 'en' | 'ja';

/**
 * 에러 코드별 메시지 맵
 */
export type TErrorMessages = Record<number, IErrorMessage>;

/**
 * 기본 메시지 (Fallback용)
 */
export interface IDefaultMessages {
  ko: IErrorMessage;
  en: IErrorMessage;
  ja: IErrorMessage;
}
