/**
 * DomainDisplay
 *
 * DomainDisplay Component
 * - shadcn/ui 기반 UI 컴포넌트
 */
'use client';

import { useEffect, useMemo, useState } from 'react';

interface IDomainDisplayProps {
  className?: string;
  showProtocol?: boolean;
  baseUrl?: string;
  appendTrailingSlash?: boolean;
}

const FALLBACK_BASE_URL = 'https://example.com';

/**
 * 도메인을 표시하는 컴포넌트
 * baseUrl prop이 없으면 현재 브라우저 도메인을 기준으로 표시합니다.
 */
export function DomainDisplay({ 
  className = '', 
  showProtocol = true,
  baseUrl,
  appendTrailingSlash = true
}: IDomainDisplayProps) {
  const initialBaseUrl = useMemo(() => {
    if (baseUrl) return baseUrl;
    if (typeof window !== 'undefined') return window.location.origin;
    return FALLBACK_BASE_URL;
  }, [baseUrl]);

  const [resolvedBaseUrl, setResolvedBaseUrl] = useState(initialBaseUrl);

  useEffect(() => {
    if (!baseUrl && typeof window !== 'undefined') {
      setResolvedBaseUrl(window.location.origin);
    }
  }, [baseUrl]);

  const normalizedBase = showProtocol
    ? resolvedBaseUrl
    : resolvedBaseUrl.replace(/^https?:\/\//, '');

  const displayDomain = appendTrailingSlash
    ? normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`
    : normalizedBase.replace(/\/$/, '');
  
  return (
    <span className={`font-mono text-sm text-muted-foreground ${className}`}>
      {displayDomain}
    </span>
  );
}
