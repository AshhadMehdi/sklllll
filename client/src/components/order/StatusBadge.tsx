import { STATUS_META } from '@/lib/constants';
import type { OrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, className, size = 'sm' }: { status: OrderStatus; className?: string; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border font-semibold', m.color, size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot, ['PENDING', 'ON_THE_WAY', 'PREPARING'].includes(status) && 'animate-pulse')} />
      {m.label}
    </span>
  );
}
