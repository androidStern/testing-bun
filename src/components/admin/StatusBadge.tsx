import { cn } from '@/lib/utils';

type Status =
  | 'pending'
  | 'pending_review'
  | 'approved'
  | 'blocked'
  | 'rejected'
  | 'processed';

const statusStyles: Record<Status, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  processed: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<Status, string> = {
  pending: 'Pending',
  pending_review: 'Pending Review',
  approved: 'Approved',
  blocked: 'Blocked',
  rejected: 'Rejected',
  processed: 'Processed',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const validStatus = status as Status;
  const style = statusStyles[validStatus] ?? 'bg-gray-100 text-gray-800';
  const label = statusLabels[validStatus] ?? status;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
