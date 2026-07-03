import type React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border border-border bg-card text-card-foreground', className)} {...props} />;
}
