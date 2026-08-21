import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link' | 'cyber' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

const variantClasses = {
  default: 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700',
  destructive: 'bg-red-600 text-white hover:bg-red-500',
  outline: 'border border-[#242424] bg-transparent text-[#f5f5f5] hover:bg-[#161616] hover:border-[#333333]',
  ghost: 'bg-transparent text-[#f5f5f5] hover:bg-[#161616]',
  link: 'bg-transparent text-green-400 underline-offset-4 hover:underline',
  cyber: 'border border-green-600/30 bg-green-600/10 text-green-400 hover:bg-green-600/20 hover:border-green-500/50',
  success: 'bg-green-600 text-white hover:bg-green-500',
};

const sizeClasses = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-7 px-3 text-xs',
  lg: 'h-10 px-6 text-sm',
  icon: 'h-9 w-9',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50',
          'disabled:pointer-events-none disabled:opacity-50',
          'select-none cursor-pointer',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
