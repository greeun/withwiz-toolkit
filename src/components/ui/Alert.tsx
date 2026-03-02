// 독립적인 Alert 컴포넌트
import React from 'react';
import { cn } from '@withwiz/utils/client/client-utils';

export interface IAlertProps {
  variant?: 'default' | 'destructive';
  children: React.ReactNode;
  className?: string;
}

export interface IAlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = 'default', children, className }: IAlertProps) {
  const variantClasses = {
    default: 'bg-background text-foreground',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
  };

  return (
    <div
      className={cn(
        'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

export function AlertDescription({ children, className }: IAlertDescriptionProps) {
  return (
    <div className={cn('text-sm [&_p]:leading-relaxed', className)}>
      {children}
    </div>
  );
}
