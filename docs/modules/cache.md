# @withwiz/cache

범용 캐싱 시스템으로 Redis, In-Memory, Hybrid 백엔드를 지원합니다.

## 주요 기능

- **다중 백엔드**: Redis, In-Memory, Hybrid (Redis + In-Memory fallback)
- **자동 폴백**: Redis 장애 시 In-Memory로 자동 전환
- **TTL 지원**: 캐시 항목별 만료 시간 설정
- **패턴 삭제**: 와일드카드를 사용한 캐시 무효화

## 사용법

```typescript
import { getCacheManager, cache, geoCache } from '@withwiz/cache';

// 기본 캐시 사용
await cache.set('key', value, { ttl: 3600 });
const data = await cache.get('key');

// 커스텀 캐시 매니저 생성
const myCache = getCacheManager('my-prefix');
await myCache.set('custom-key', value);
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CACHE_ENABLED` | `true` | 캐시 활성화 여부 |
| `CACHE_REDIS_ENABLED` | `true` | Redis 백엔드 활성화 |
| `CACHE_INMEMORY_ENABLED` | `true` | In-Memory 백엔드 활성화 |
| `UPSTASH_REDIS_REST_URL` | - | Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | - | Redis 인증 토큰 |

## InMemory 캐시 제한 설정

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CACHE_INMEMORY_MAX_SIZE` | `100000` | 인스턴스별 최대 캐시 항목 수 |
| `CACHE_INMEMORY_MAX_MB` | `200` | 인스턴스별 최대 메모리 사용량 (MB) |
| `CACHE_INMEMORY_EVICTION` | `lru` | 제거 정책: `lru` / `fifo` / `ttl` |
| `CACHE_INMEMORY_CLEANUP_INTERVAL` | `60000` | 만료 항목 정리 주기 (ms) |

### Per-Instance 적용

**MAX_SIZE와 MAX_MB는 글로벌이 아닌 인스턴스별(per-prefix)로 적용됩니다.**

각 `getCacheManager(prefix)` 호출은 독립적인 `InMemoryCacheManager` 인스턴스를 생성하며, 각 인스턴스가 독립적으로 MAX_SIZE와 MAX_MB 제한을 가집니다.

```
인스턴스 "link"      → 자체 Map, 자체 100,000개/200MB 제한
인스턴스 "analytics" → 자체 Map, 자체 100,000개/200MB 제한
인스턴스 "user"      → 자체 Map, 자체 100,000개/200MB 제한
...
```

### Eviction 발동 조건

`set()` 호출 시 **MAX_SIZE 또는 MAX_MB 중 하나라도 초과하면** eviction이 발동됩니다 (OR 조건):

```typescript
// inmemory-cache-manager.ts:352-358
private needsEviction(newItemSize: number): boolean {
  const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
  return (
    this.cache.size >= this.config.maxSize ||           // 항목 수 초과
    this.currentMemoryBytes + newItemSize > maxMemoryBytes  // 메모리 초과
  );
}
```

Eviction 순서:
1. 이미 만료된 항목 먼저 제거
2. 정책에 따라 제거 (LRU: 가장 오래 미접근 / FIFO: 가장 먼저 삽입 / TTL: 가장 빨리 만료)

### Eviction 정책

| 정책 | 설명 | 특징 |
|------|------|------|
| `lru` (기본) | Least Recently Used - 가장 오래 접근되지 않은 항목 제거 | 자주 접근하는 항목 보호 |
| `fifo` | First In First Out - 가장 먼저 삽입된 항목 제거 | 접근 패턴 무관, 삽입 순서 기준 |
| `ttl` | Time To Live - 가장 빨리 만료될 항목 제거 | 만료 임박 항목 우선 제거 |

### 이론적 최대 메모리 계산

프로젝트에서 생성하는 인스턴스 수에 따라 이론적 최대 메모리가 결정됩니다:

```
이론적 최대 메모리 = 인스턴스 수 × CACHE_INMEMORY_MAX_MB
```

실제 사용량은 TTL 만료와 60초 주기 cleanup으로 이론 최대치보다 훨씬 낮습니다.

## 백엔드 조합

| REDIS | INMEMORY | 결과 |
|-------|----------|------|
| true | true | Hybrid (Redis 기본, In-Memory fallback) |
| true | false | Redis 전용 |
| false | true | In-Memory 전용 |
| false | false | 캐시 비활성화 |

## 캐시 무효화

```typescript
import { invalidateCache } from '@withwiz/cache';

// 단일 키 삭제
await invalidateCache.byKey('my-key');

// 패턴으로 삭제
await invalidateCache.byPattern('user:*');

// 전체 캐시 삭제
await invalidateCache.all();
```

## 프로젝트 특화 캐시

프로젝트별 특화 캐시 인스턴스는 프로젝트 내에서 직접 생성하세요:

```typescript
// src/lib/cache/my-project-cache.ts
import { getCacheManager } from '@withwiz/cache';

export const userCache = getCacheManager('user');
export const analyticsCache = getCacheManager('analytics');
```
