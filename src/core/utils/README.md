# Shared Utilities

This folder contains utility functions that can be reused across other projects.

## 📁 Structure

- `client/` - Client-only utilities
- `common/` - Utilities shared between server and client
- `server/` - Server-only utilities

## 🖥️ Client Utilities

### cn (class merge)
A function that merges Tailwind CSS classes.

```tsx
import { cn } from '@/shared/utils/client/client-utils';

<div className={cn('base-class', condition && 'conditional-class')} />
```

### copyToClipboard
A function that copies text to the clipboard.

```tsx
import { copyToClipboard } from '@/shared/utils/client/client-utils';

const success = await copyToClipboard('복사할 텍스트');
if (success) {
  console.log('복사 성공');
}
```

## 🌐 Common Utilities

### Timezone Utilities
Timezone-related functions for global services.

```tsx
import { 
  formatUserFriendlyDate,
  formatTableDateTime,
  getRelativeTime,
  getUserTimezone,
  getCurrentUTC,
  utcToLocal,
  localToUTC
} from '@/shared/utils/common/timezone';

// User-friendly date format
const formatted = formatUserFriendlyDate(new Date());

// Date/time format for tables (two-line display)
const { date, time } = formatTableDateTime(new Date());

// Relative time display
const relative = getRelativeTime(new Date()); // "2시간 전"

// Get the user's timezone
const timezone = getUserTimezone();

// UTC time manipulation
const utc = getCurrentUTC();
const local = utcToLocal(utc);
const backToUtc = localToUTC(local);
```

### GeoIP Utilities
Functions that retrieve geolocation information for an IP address.

```tsx
import { 
  getGeoLocation,
  getGeoLocationBatch,
  isPrivateIP,
  type IGeoLocationData,
  type IGeoIPResponse
} from '@/shared/geolocation/geoip';

// Single IP lookup
const geoData: IGeoIPResponse = await getGeoLocation('192.168.1.1');

if (geoData.success && geoData.data) {
  console.log(geoData.data.country); // "KR"
  console.log(geoData.data.city); // "Seoul"
}

// Batch IP lookup (performance optimized)
const ipAddresses = ['192.168.1.1', '8.8.8.8', '1.1.1.1'];
const geoMap = await getGeoLocationBatch(ipAddresses);

// Private IP check
const isPrivate = isPrivateIP('192.168.1.1'); // true
```

### Logging Utilities
Functions for structured logging.

```tsx
import { 
  logger,
  logDebug,
  logInfo,
  logError,
  logApiRequest,
  logApiResponse
} from '@/shared/logger/logger';

// Basic logging
logInfo('정보 메시지');
logError('에러 메시지', { error: new Error('test'), userId: '123' });

// API request/response logging
logApiRequest(request, { userId: '123', action: 'create_link' });
logApiResponse(response, { duration: 150, statusCode: 200 });
```

### Cache Utilities
Functions for managing the Redis cache.

```tsx
import { 
  getCache,
  setCache,
  deleteCache,
  withCache,
  checkRedisConnection
} from '@/shared/cache/cache';

// Get/set cache
const cached = await getCache('user:123');
await setCache('user:123', userData, 3600); // 1 hour TTL

// Cache wrapper function (runs the function and stores the result if not cached)
const result = await withCache('expensive-operation', async () => {
  return await expensiveOperation();
}, 3600);

// Delete cache
await deleteCache('user:123');

// Redis connection check
const status = await checkRedisConnection();
if (status.success) {
  console.log('Redis 연결 성공');
}
```

## 📋 Checklist

### Client Utilities
- [ ] Install clsx, tailwind-merge
- [ ] Verify browser compatibility

### Common Utilities
- [ ] Install timezone library (if needed)
- [ ] Configure GeoIP API key
- [ ] Configure Redis connection
- [ ] Configure logging

### Environment Variables
```env
# GeoIP (optional)
IPGEO_API_KEY=your_api_key_here

# Redis (when using cache)
REDIS_REST_URL=your_redis_url
REDIS_REST_TOKEN=your_redis_token
```

## 🔧 Configuration

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "paths": {
      "@/shared/*": ["./shared/*"]
    }
  }
}
```

### Next.js Configuration
```javascript
// next.config.js
module.exports = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
}
```
