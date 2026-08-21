import * as React from 'react';
import { cn } from '@/lib/utils';
import { getSeverityBg } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'severity';
  severity?: string;
}

const variantClasses = {
  default: 'bg-[#16a34a]/20 text-[#4ade80] border border-[#16a34a]/30',
  secondary: 'bg-[#161616] text-[#a1a1aa] border border-[#242424]',
  outline: 'bg-transparent text-[#f5f5f5] border border-[#242424]',
  success: 'bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30',
  warning: 'bg-[#a1a1aa]/15 text-[#d4d4d8] border border-[#a1a1aa]/30',
  danger: 'bg-[#dc2626]/15 text-[#f87171] border border-[#dc2626]/30',
  severity: '',
};

export function Badge({ className, variant = 'default', severity, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'severity' && severity ? getSeverityBg(severity) : variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
