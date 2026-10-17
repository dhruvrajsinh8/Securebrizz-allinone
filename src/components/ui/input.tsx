import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b572f]">
            {leftIcon}
          </span>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border border-[#e3d2a9] bg-[#efe1c4] px-3 py-1 text-sm text-[#2a2013]',
            'placeholder:text-[#6b572f]',
            'transition-all duration-200',
            'focus:border-[#6b7f3a] focus:outline-none focus:ring-1 focus:ring-[#6b7f3a]/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[#a8402e] focus:border-[#a8402e] focus:ring-[#a8402e]/30',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b572f]">
            {rightIcon}
          </span>
        )}
        {error && (
          <p className="mt-1 text-xs text-[#a8402e]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
