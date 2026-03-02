// 독립적인 Tooltip 컴포넌트
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@withwiz/utils/client/client-utils';

export interface ITooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  delayDuration?: number;
}

export interface ITooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export interface ITooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function Tooltip({ 
  children, 
  content, 
  className, 
  delayDuration = 200 
}: ITooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delayDuration);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen && triggerRef.current && contentRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      
      setPosition({
        top: triggerRect.bottom + window.scrollY + 8,
        left: triggerRect.left + window.scrollX + (triggerRect.width - contentRect.width) / 2
      });
    }
  }, [isOpen]);

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isOpen && (
        <div
          ref={contentRef}
          className="absolute z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{
            top: position.top,
            left: position.left
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function TooltipTrigger({ children, asChild = false, className }: ITooltipTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>;
    return React.cloneElement(children, {
      ...childProps,
      className: cn(childProps.className as string | undefined, className)
    } as React.Attributes);
  }
  
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}

export function TooltipContent({ 
  children, 
  className, 
  side = 'top', 
  align = 'center' 
}: ITooltipContentProps) {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}
