import * as React from 'react';
import { cn } from '@/lib/utils';
import { getSeverityBg } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'severity';
  severity?: string;
}

const variantClasses = {
  default: 'bg-[#6b7f3a]/20 text-[#47601f] border border-[#6b7f3a]/30',
  secondary: 'bg-[#efe1c4] text-[#6b572f] border border-[#e3d2a9]',
  outline: 'bg-transparent text-[#2a2013] border border-[#e3d2a9]',
  success: 'bg-[#7f9548]/15 text-[#7f9548] border border-[#7f9548]/30',
  warning: 'bg-[#6b572f]/15 text-[#4a3b1f] border border-[#6b572f]/30',
  danger: 'bg-[#a8402e]/15 text-[#8a3122] border border-[#a8402e]/30',
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
