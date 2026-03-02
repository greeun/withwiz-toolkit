/**
 * TimezoneDisplay
 *
 * TimezoneDisplay Component
 * - shadcn/ui 기반 UI 컴포넌트
 */
'use client';

import { useSimpleTimezone } from '@withwiz/hooks/useTimezone';
import { Clock, Globe } from 'lucide-react';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';

interface ITimezoneDisplayProps {
  showIcon?: boolean;
  showOffset?: boolean;
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 사용자 타임존을 표시하는 컴포넌트
 */
export function TimezoneDisplay({ 
  showIcon = true, 
  showOffset = true, 
  variant = 'outline',
  size = 'md'
}: ITimezoneDisplayProps) {
  const { timezone, offsetFormatted, isLoading, display } = useSimpleTimezone();

  if (isLoading) {
    return <Skeleton className="h-4 w-24" />;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <Badge variant={variant} className={`${sizeClasses[size]} flex items-center gap-1.5`}>
      {showIcon && <Globe className="h-3 w-3" />}
      <span className="font-medium">{timezone}</span>
      {showOffset && (
        <span className="text-muted-foreground">({offsetFormatted})</span>
      )}
    </Badge>
  );
}

/**
 * 간단한 타임존 표시 (아이콘 없음)
 */
export function SimpleTimezoneDisplay({ 
  showOffset = true,
  variant = 'secondary',
  size = 'sm'
}: Omit<ITimezoneDisplayProps, 'showIcon'>) {
  const { timezone, offsetFormatted, isLoading } = useSimpleTimezone();

  if (isLoading) {
    return <Skeleton className="h-3 w-20" />;
  }

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <span className={`${sizeClasses[size]} text-muted-foreground`}>
      {timezone}
      {showOffset && ` (${offsetFormatted})`}
    </span>
  );
}

/**
 * 타임존 정보를 툴팁으로 표시하는 컴포넌트
 */
export function TimezoneTooltip({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  const { timezone, offsetFormatted, isLoading } = useSimpleTimezone();

  if (isLoading) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span 
      className={className}
      title={`현재 타임존: ${timezone} (${offsetFormatted})`}
    >
      {children}
    </span>
  );
}
