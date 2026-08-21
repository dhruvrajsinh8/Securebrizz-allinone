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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]">
            {leftIcon}
          </span>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border border-[#242424] bg-[#161616] px-3 py-1 text-sm text-[#f5f5f5]',
            'placeholder:text-[#a1a1aa]',
            'transition-all duration-200',
            'focus:border-[#16a34a] focus:outline-none focus:ring-1 focus:ring-[#16a34a]/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/30',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]">
            {rightIcon}
          </span>
        )}
        {error && (
          <p className="mt-1 text-xs text-[#dc2626]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
