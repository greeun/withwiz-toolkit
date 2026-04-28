/**
 * @deprecated friendly-messages-v2.ts를 사용하세요.
 * 이 파일은 하위 호환용으로만 유지됩니다. 신규 코드에서 import하지 마세요.
 *
 * 사용자 친화적 에러 메시지 정의
 * 5자리 HTTP 확장 에러 코드별 프렌들리 메시지
 */

import { getErrorCategory } from '@withwiz/constants/error-codes';

export interface IFriendlyMessage {
  title: string;
  description: string;
  action?: string;
}

export interface IErrorDisplay {
  code: number;
  title: string;
  description: string;
  action?: string;
  icon: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

type TLocale = 'ko' | 'en';

// 한국어 메시지
const koMessages: Record<number, IFriendlyMessage> = {
  // 검증 (400xx)
  40001: { title: '입력 정보를 확인해 주세요', description: '입력하신 정보 중 일부가 올바르지 않습니다.', action: '입력 내용을 다시 확인해 주세요.' },
  40002: { title: '요청을 처리할 수 없어요', description: '요청 형식이 올바르지 않습니다.', action: '페이지를 새로고침해 주세요.' },
  40003: { title: '입력값이 올바르지 않아요', description: '허용되지 않는 형식입니다.', action: '올바른 형식으로 입력해 주세요.' },
  40004: { title: '필수 정보가 빠졌어요', description: '필수 항목이 비어 있습니다.', action: '모든 필수 항목을 입력해 주세요.' },
  40005: { title: 'URL 형식을 확인해 주세요', description: 'https://로 시작하는 URL을 입력해 주세요.', action: '예: https://example.com' },
  40006: { title: '이메일 형식을 확인해 주세요', description: '올바른 이메일 주소가 아닙니다.', action: '예: user@example.com' },
  40007: { title: '더 안전한 비밀번호가 필요해요', description: '8자 이상, 영문/숫자/특수문자 포함', action: '더 복잡한 비밀번호를 설정해 주세요.' },
  // 인증 (401xx)
  40101: { title: '로그인이 필요해요', description: '이 기능은 로그인이 필요합니다.', action: '로그인 후 다시 시도해 주세요.' },
  40102: { title: '인증 정보가 올바르지 않아요', description: '로그인 상태가 유효하지 않습니다.', action: '다시 로그인해 주세요.' },
  40103: { title: '로그인이 만료되었어요', description: '보안을 위해 세션이 만료되었습니다.', action: '다시 로그인해 주세요.' },
  40106: { title: '로그인에 실패했어요', description: '이메일 또는 비밀번호가 일치하지 않습니다.', action: '다시 시도해 주세요.' },
  40107: { title: '세션이 종료되었어요', description: '자동 로그아웃되었습니다.', action: '다시 로그인해 주세요.' },
  // 권한 (403xx)
  40304: { title: '접근 권한이 없어요', description: '이 기능에 대한 권한이 없습니다.', action: '관리자에게 문의해 주세요.' },
  40305: { title: '이메일 인증이 필요해요', description: '이메일 인증을 먼저 완료해 주세요.', action: '메일함을 확인해 주세요.' },
  40308: { title: '계정이 비활성화되었어요', description: '서비스를 이용할 수 없습니다.', action: '고객센터로 문의해 주세요.' },
  40309: { title: '계정이 잠금되었어요', description: '로그인 실패로 계정이 잠겼습니다.', action: '잠시 후 다시 시도해 주세요.' },
  // 리소스 (404xx)
  40401: { title: '찾을 수 없어요', description: '요청하신 항목이 존재하지 않습니다.', action: '주소를 확인해 주세요.' },
  40402: { title: '사용자를 찾을 수 없어요', description: '해당 사용자가 존재하지 않습니다.' },
  // 충돌 (409xx)
  40904: { title: '충돌이 발생했어요', description: '기존 데이터와 충돌합니다.', action: '잠시 후 다시 시도해 주세요.' },
  40905: { title: '이미 존재해요', description: '동일한 항목이 있습니다.', action: '다른 값을 사용해 주세요.' },
  40906: { title: '이미 등록된 이메일이에요', description: '다른 계정에서 사용 중입니다.', action: '다른 이메일을 사용해 주세요.' },
  // 비즈니스 (422xx)
  42201: { title: '처리할 수 없어요', description: '현재 상태에서 처리할 수 없습니다.', action: '조건을 확인해 주세요.' },
  42202: { title: '지금은 할 수 없는 작업이에요', description: '현재 상태에서 불가능합니다.' },
  42203: { title: '사용량을 초과했어요', description: '한도를 초과했습니다.', action: '플랜 업그레이드를 고려해 주세요.' },
  42211: { title: '파일이 너무 커요', description: '최대 크기를 초과했습니다.', action: '작은 파일을 선택해 주세요.' },
  42212: { title: '지원하지 않는 파일 형식이에요', description: '업로드할 수 없습니다.', action: '지원 형식을 확인해 주세요.' },
  // Rate Limit (429xx)
  42901: { title: '잠시 쉬어가세요', description: '요청이 너무 많습니다.', action: '잠시 후 다시 시도해 주세요.' },
  42902: { title: '오늘 사용량을 모두 사용했어요', description: '일일 한도에 도달했습니다.', action: '내일 다시 이용해 주세요.' },
  42903: { title: 'API 할당량을 초과했어요', description: 'API 한도를 초과했습니다.', action: '플랜 업그레이드를 고려해 주세요.' },
  // 서버 (500xx)
  50001: { title: '문제가 발생했어요', description: '서버 오류가 발생했습니다.', action: '잠시 후 다시 시도해 주세요.' },
  50002: { title: '일시적인 오류예요', description: '곧 복구됩니다.', action: '잠시 후 다시 시도해 주세요.' },
  50003: { title: '데이터 처리 오류예요', description: '데이터 처리 중 문제가 발생했습니다.', action: '잠시 후 다시 시도해 주세요.' },
  50006: { title: '이메일을 보내지 못했어요', description: '이메일 전송에 실패했습니다.', action: '잠시 후 다시 시도해 주세요.' },
  50007: { title: '일시적인 오류예요', description: '캐시 처리 중 문제가 있습니다.', action: '페이지를 새로고침해 주세요.' },
  50008: { title: '파일 업로드에 실패했어요', description: '파일 저장 중 문제가 있습니다.', action: '다시 시도해 주세요.' },
  // 서비스 불가 (503xx)
  50304: { title: '외부 서비스 연결 실패', description: '외부 서비스가 응답하지 않습니다.', action: '잠시 후 다시 시도해 주세요.' },
  50305: { title: '서비스 점검 중이에요', description: '점검 중입니다.', action: '잠시 후 다시 방문해 주세요.' },
  // 보안 (403xx - 71~79)
  40371: { title: '접근이 차단되었어요', description: '보안 정책으로 차단되었습니다.', action: '정상적인 방법으로 다시 시도해 주세요.' },
  40372: { title: '보안 검증 실패', description: '보안 토큰이 만료되었습니다.', action: '페이지를 새로고침해 주세요.' },
  40373: { title: '사용할 수 없는 URL이에요', description: '보안상 차단된 URL입니다.', action: '다른 URL을 사용해 주세요.' },
  40374: { title: '비정상 활동 감지', description: '일시적으로 제한되었습니다.', action: '고객센터로 문의해 주세요.' },
  40375: { title: 'IP가 차단되었어요', description: '보안 정책에 의해 차단되었습니다.', action: '고객센터로 문의해 주세요.' },
  40376: { title: 'CORS 정책 위반이에요', description: '허용되지 않은 출처에서의 요청입니다.', action: '올바른 주소로 접속해 주세요.' },
};

// 기본 메시지
const defaultMessages: Record<TLocale, IFriendlyMessage> = {
  ko: { title: '문제가 발생했어요', description: '예상치 못한 오류가 발생했습니다.', action: '잠시 후 다시 시도해 주세요.' },
  en: { title: 'Something went wrong', description: 'An unexpected error occurred.', action: 'Please try again later.' },
};

// 카테고리별 아이콘
const categoryIcons: Record<ReturnType<typeof getErrorCategory>, string> = {
  validation: '⚠️', auth: '🔐', permission: '🚫', resource: '🔍', conflict: '⚡',
  business: '📋', rateLimit: '⏱️', server: '🔧', security: '🛡️', unknown: '❌',
};

// 카테고리별 심각도
const categorySeverity: Record<ReturnType<typeof getErrorCategory>, IErrorDisplay['severity']> = {
  validation: 'warning', auth: 'warning', permission: 'warning', resource: 'info',
  conflict: 'warning', business: 'warning', rateLimit: 'warning', server: 'error',
  security: 'critical', unknown: 'error',
};

export function getFriendlyMessage(code: number, locale: TLocale = 'ko'): IFriendlyMessage {
  return koMessages[code] || defaultMessages[locale];
}

export function getErrorDisplayInfo(code: number, locale: TLocale = 'ko'): IErrorDisplay {
  const message = getFriendlyMessage(code, locale);
  const category = getErrorCategory(code);
  return { code, title: message.title, description: message.description, action: message.action, icon: categoryIcons[category], severity: categorySeverity[category] };
}

export function formatFriendlyError(code: number, locale: TLocale = 'ko'): string {
  const { title, description } = getFriendlyMessage(code, locale);
  return `${title} - ${description} [${code}]`;
}
