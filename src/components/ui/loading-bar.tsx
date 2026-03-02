/**
 * loading-bar
 *
 * loading-bar Component
 * - shadcn/ui 기반 UI 컴포넌트
 */
"use client";

import { useEffect, useState } from "react";
import { cn } from "@withwiz/utils/client/client-utils";

interface LoadingBarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "secondary";
  animated?: boolean;
}

export function LoadingBar({ 
  className, 
  size = "md", 
  variant = "default",
  animated = true
}: LoadingBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!animated) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          return 0;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [animated]);

  const sizeClasses = {
    sm: "h-1",
    md: "h-2", 
    lg: "h-3"
  };

  const variantClasses = {
    default: "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500",
    primary: "bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400",
    secondary: "bg-gradient-to-r from-gray-600 via-gray-500 to-gray-400"
  };

  return (
    <div className={cn(
      "w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden",
      sizeClasses[size],
      className
    )}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300 ease-out",
          variantClasses[variant]
        )}
        style={{
          width: animated ? `${Math.min(progress, 100)}%` : "100%",
          backgroundSize: "200% 100%",
          animation: animated ? "shimmer 2s ease-in-out infinite" : "none"
        }}
      />
      {animated && (
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
          `
        }} />
      )}
    </div>
  );
}

export function LoadingBarWithText({ 
  className, 
  size = "md", 
  variant = "default",
  text = "Loading data...",
  animated = true
}: LoadingBarProps & { text?: string }) {
  return (
    <div className={cn("flex flex-col items-center space-y-3 py-8", className)}>
      <LoadingBar size={size} variant={variant} className="w-64" animated={animated} />
      <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
        {text}
      </p>
    </div>
  );
}

export function LoadingBarCompact({ 
  className, 
  size = "sm", 
  variant = "primary",
  animated = true
}: LoadingBarProps) {
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <LoadingBar size={size} variant={variant} className="flex-1" animated={animated} />
      {animated && (
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
      )}
    </div>
  );
}

// 통합된 로딩 컴포넌트 (기존 LoadingCard 대체)
interface LoadingCardProps {
  variant?: "card" | "bar" | "compact" | "text";
  text?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

export function LoadingCard({ 
  variant = "card", 
  text = "Loading...", 
  className,
  size = "md",
  animated = true
}: LoadingCardProps) {
  switch (variant) {
    case "bar":
      return <LoadingBar size={size} className={className} animated={animated} />;
    case "compact":
      return <LoadingBarCompact size={size} className={className} animated={animated} />;
    case "text":
      return <LoadingBarWithText text={text} size={size} className={className} animated={animated} />;
    case "card":
    default:
      return (
        <div className={cn("bg-white border border-gray-200 rounded-lg shadow-sm", className)}>
          <div className="p-6">
            <div className="py-8 text-center text-gray-500">
              <LoadingBarCompact size="sm" className="mb-4" animated={animated} />
              <p className="text-sm">{text}</p>
            </div>
          </div>
        </div>
      );
  }
} 
