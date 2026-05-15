/**
 * Error Message Formatter
 *
 * 사용자 친화적인 에러 메시지로 변환하는 유틸리티
 */

/**
 * Redis 에러 메시지를 사용자 친화적으로 정제
 */
export function formatRedisError(errorMessage: string): string {
  if (!errorMessage) {
    return 'Unknown Redis error';
  }

  // Command failed 제거하고 실제 에러만 표시
  let cleanMessage = errorMessage;
  
  if (cleanMessage.startsWith('Command failed:')) {
    cleanMessage = cleanMessage.replace(/^Command failed:\s*/, '').trim();
  }
  
  // ERR 접두사 제거
  if (cleanMessage.startsWith('ERR ')) {
    cleanMessage = cleanMessage.replace(/^ERR\s+/, '').trim();
  }
  
  // 외부 문서 링크 제거 ("See https://... for details")
  cleanMessage = cleanMessage.replace(/\s*See https?:\/\/\S+\s*for details.*$/i, '').trim();

  // Redis 요청 한도 초과
  if (cleanMessage.includes('max requests limit exceeded')) {
    const limitMatch = cleanMessage.match(/Limit:\s*(\d+)/);
    const usageMatch = cleanMessage.match(/Usage:\s*(\d+)/);

    if (limitMatch && usageMatch) {
      const limit = parseInt(limitMatch[1]);
      const limitInK = Math.floor(limit / 1000);

      return `Redis request limit exceeded (${limitInK}K requests used). Please upgrade your plan or wait for the quota to reset.`;
    }

    return 'Redis request limit exceeded. Please check your Redis provider plan.';
  }

  // Connection timeout
  if (cleanMessage.includes('timeout') || cleanMessage.includes('ETIMEDOUT')) {
    return 'Redis connection timeout. Please check network connectivity.';
  }

  // Authentication error
  if (cleanMessage.includes('NOAUTH') || cleanMessage.includes('authentication') || cleanMessage.includes('invalid password')) {
    return 'Redis authentication failed. Please check your credentials.';
  }

  // Connection refused
  if (cleanMessage.includes('ECONNREFUSED') || cleanMessage.includes('connection refused')) {
    return 'Redis connection refused. Please check Redis server status.';
  }

  // Network error
  if (cleanMessage.includes('ENOTFOUND') || cleanMessage.includes('getaddrinfo')) {
    return 'Redis server not found. Please check the Redis URL.';
  }

  // Generic network error
  if (cleanMessage.includes('network') || cleanMessage.includes('ENETUNREACH')) {
    return 'Network error connecting to Redis.';
  }

  // 너무 긴 메시지 축약 (100자 이상)
  if (cleanMessage.length > 100) {
    return cleanMessage.substring(0, 100) + '...';
  }

  return cleanMessage;
}

/**
 * 데이터베이스 에러 메시지를 사용자 친화적으로 정제
 */
export function formatDatabaseError(errorMessage: string): string {
  if (!errorMessage) {
    return 'Unknown database error';
  }

  // Connection timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return 'Database connection timeout. Please check network connectivity.';
  }

  // Connection refused
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
    return 'Database connection refused. Please check database server status.';
  }

  // Authentication error
  if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
    return 'Database authentication failed. Please check your credentials.';
  }

  // Too many connections
  if (errorMessage.includes('too many connections') || errorMessage.includes('connection limit')) {
    return 'Database connection limit reached. Please try again later.';
  }

  // Database not found
  if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
    return 'Database not found. Please check your configuration.';
  }

  return errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage;
}

/**
 * 일반적인 에러 메시지를 사용자 친화적으로 정제
 */
export function formatGenericError(errorMessage: string): string {
  if (!errorMessage) {
    return 'Unknown error occurred';
  }

  // 너무 긴 메시지 축약
  if (errorMessage.length > 150) {
    return errorMessage.substring(0, 150) + '...';
  }

  return errorMessage;
}
