/**
 * environment
 *
 * environment
 * - System
 */
import { IEnvironmentInfo } from './types';
import { getPlatform } from './utils';
import os from 'os';
import { getAuthConfig } from '../auth/config';
import { getResolvedCacheConfig } from '../cache/config';
import { getGeolocationConfig } from '../geolocation/config';
import { getCommonConfig } from '../config/common';

export function checkEnvironmentVariables(): IEnvironmentInfo[] {
  const platform = getPlatform();
  const results: IEnvironmentInfo[] = [];

  // Auth 설정 체크
  try {
    const auth = getAuthConfig();
    results.push({
      key: 'JWT_SECRET',
      ok: true,
      value: auth.jwtSecret.length > 20 ? auth.jwtSecret.substring(0, 20) + '...' : auth.jwtSecret
    });
  } catch {
    results.push({ key: 'JWT_SECRET', ok: false });
  }

  // Cache/Redis 설정 체크
  try {
    const cache = getResolvedCacheConfig();
    results.push({
      key: 'CACHE_ENABLED',
      ok: true,
      value: String(cache.enabled)
    });
    if (cache.redis) {
      results.push({
        key: 'REDIS_REST_URL',
        ok: true,
        value: cache.redis.url.length > 20 ? cache.redis.url.substring(0, 20) + '...' : cache.redis.url
      });
      results.push({ key: 'REDIS_REST_TOKEN', ok: true, value: '***' });
    } else {
      results.push({ key: 'REDIS_REST_URL', ok: false });
      results.push({ key: 'REDIS_REST_TOKEN', ok: false });
    }
  } catch {
    results.push({ key: 'CACHE_ENABLED', ok: false });
    results.push({ key: 'REDIS_REST_URL', ok: false });
    results.push({ key: 'REDIS_REST_TOKEN', ok: false });
  }

  // Geolocation 설정 체크
  try {
    const geo = getGeolocationConfig();
    results.push({ key: 'IPGEOLOCATION_API_KEY', ok: !!geo.ipgeolocationApiKey });
    results.push({ key: 'MAXMIND_LICENSE_KEY', ok: !!geo.maxmindLicenseKey });
  } catch {
    results.push({ key: 'IPGEOLOCATION_API_KEY', ok: false });
    results.push({ key: 'MAXMIND_LICENSE_KEY', ok: false });
  }

  // 플랫폼별 환경 정보 추가
  results.push({
    key: 'PLATFORM',
    ok: true,
    value: platform === 'darwin' ? 'macOS' : 'Linux'
  });

  // NODE_ENV: common config에서 읽되, 미초기화 시 폴백
  let nodeEnvValue: string;
  try {
    nodeEnvValue = getCommonConfig().nodeEnv;
  } catch {
    nodeEnvValue = 'development';
  }
  results.push({
    key: 'NODE_ENV',
    ok: true,
    value: nodeEnvValue
  });

  results.push({
    key: 'ARCHITECTURE',
    ok: true,
    value: process.arch
  });

  results.push({
    key: 'NODE_VERSION',
    ok: true,
    value: process.version
  });

  // 시스템 환경 정보 추가
  results.push({
    key: 'HOSTNAME',
    ok: true,
    value: os.hostname()
  });

  results.push({
    key: 'USER_HOME',
    ok: true,
    value: os.homedir()
  });

  results.push({
    key: 'TEMP_DIR',
    ok: true,
    value: os.tmpdir()
  });

  // 플랫폼별 특정 환경 정보
  if (platform === 'darwin') {
    results.push({
      key: 'MACOS_VERSION',
      ok: true,
      value: os.release()
    });
  } else {
    results.push({
      key: 'LINUX_DISTRO',
      ok: true,
      value: os.release()
    });
  }

  return results;
}
