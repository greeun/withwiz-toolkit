/**
 * environment
 *
 * environment
 * - System
 */
import { IEnvironmentInfo } from './types';
import { getPlatform } from './utils';
import os from 'os';

export function checkEnvironmentVariables(): IEnvironmentInfo[] {
  const platform = getPlatform();
  const requiredVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_BASE_URL',
    'JWT_SECRET',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];

  const optionalVars = [
    'IPGEOLOCATION_API_KEY',
    'MAXMIND_LICENSE_KEY',
    'CACHE_ENABLED'
  ];

  const results: IEnvironmentInfo[] = [];

  // 필수 환경 변수 체크
  for (const key of requiredVars) {
    const value = process.env[key];
    const ok = !!value;
    
    results.push({
      key,
      ok,
      value: ok ? (value!.length > 20 ? value!.substring(0, 20) + '...' : value!) : undefined
    });
  }

  // 선택적 환경 변수 체크
  for (const key of optionalVars) {
    const value = process.env[key];
    const ok = !!value;
    
    results.push({
      key,
      ok,
      value: ok ? (value!.length > 20 ? value!.substring(0, 20) + '...' : value!) : undefined
    });
  }

  // 플랫폼별 환경 정보 추가
  results.push({
    key: 'PLATFORM',
    ok: true,
    value: platform === 'darwin' ? 'macOS' : 'Linux'
  });

  results.push({
    key: 'NODE_ENV',
    ok: true,
    value: process.env.NODE_ENV || 'development'
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