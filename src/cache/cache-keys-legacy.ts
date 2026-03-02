/**
 * Legacy Cache Keys
 *
 * @deprecated CacheKeys (<your-project>/config/cache-keys.ts)를 사용하세요.
 *
 * 캐시 키 생성 헬퍼 함수들 (레거시 호환성 유지)
 */

// ============================================================================
// 캐시 키 생성 헬퍼 (deprecated)
// ============================================================================

/**
 * @deprecated CacheKeys (<your-project>/config/cache-keys.ts)를 사용하세요.
 * 이 객체는 레거시 호환성을 위해 유지됩니다.
 */
export const cacheKeys = {
  // 분석 데이터 캐시 키
  geographyStats: (linkId: string) => `geography:${linkId}`,
  timelineStats: (linkId: string) => `timeline:${linkId}`,
  deviceStats: (linkId: string) => `devices:${linkId}`,
  browserStats: (linkId: string) => `browsers:${linkId}`,
  osStats: (linkId: string) => `os:${linkId}`,

  // 관리자 통계 캐시 키
  adminCountryStats: () => 'admin:stats:country',
  adminCityStats: () => 'admin:stats:city',
  adminDailyStats: () => 'admin:stats:daily',
  adminDeviceStats: () => 'admin:stats:device',
  adminBrowserStats: () => 'admin:stats:browser',

  // 사용자 데이터 캐시 키
  userLinks: (userId: string) => `user:links:${userId}`,
  userStats: (userId: string) => `user:stats:${userId}`,

  // 링크 데이터 캐시 키
  linkInfo: (linkId: string) => `link:info:${linkId}`,
  linkClicks: (linkId: string) => `link:clicks:${linkId}`,

  // GeoLocation 캐시 키
  geoLocation: (ipAddress: string) => `geo:${ipAddress}`,

  // 커뮤니티 캐시 키
  community: {
    popularTags: (period: string, limit: number) => `popular-tags:${period}:${limit}`,
    tagLinks: (tagId: string, page: number, pageSize: number, sortBy: string, period: string) =>
      `tag-links:${tagId}:${page}:${pageSize}:${sortBy}:${period}`,
    recentLinks: (page: number, pageSize: number) => `recent-links:${page}:${pageSize}`,
    trendingLinks: (period: string, algorithm: string, limit: number) =>
      `trending-links:${period}:${algorithm}:${limit}`,
    searchLinks: (query: string, tagIds: string, sortBy: string, page: number, pageSize: number) =>
      `search:${query}:${tagIds}:${sortBy}:${page}:${pageSize}`,
  },
};
