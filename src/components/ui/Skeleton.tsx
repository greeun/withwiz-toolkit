// 독립적인 Skeleton 컴포넌트
import React from 'react';
import { cn } from '@withwiz/utils/client/client-utils';

export interface ISkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className, children }: ISkeletonProps) {
  return (
    <div 
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    >
      {children}
    </div>
  );
}
