import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

import { StatusBadge } from './StatusBadge';

interface SenderCardProps {
  sender: {
    _id: Id<'senders'>;
    phone: string;
    status: string;
    name?: string;
    company?: string;
    notes?: string;
    createdAt: number;
    messageCount?: number;
  };
  firstMessagePreview?: string;
  showActions?: boolean;
}

export function SenderCard({
  sender,
  firstMessagePreview,
  showActions = false,
}: SenderCardProps) {
  const updateStatus = useMutation({
    mutationFn: useConvexMutation(api.senders.updateStatus),
  });

  const handleApprove = () => {
    updateStatus.mutate({ senderId: sender._id, status: 'approved' });
  };

  const handleBlock = () => {
    updateStatus.mutate({ senderId: sender._id, status: 'blocked' });
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{sender.phone}</span>
              <StatusBadge status={sender.status} />
            </div>
            {sender.name && (
              <div className="mt-1 text-sm text-gray-600">{sender.name}</div>
            )}
            {sender.company && (
              <div className="text-sm text-gray-500">{sender.company}</div>
            )}
            {firstMessagePreview && (
              <div className="mt-2 text-sm text-gray-600 italic">
                "{firstMessagePreview.slice(0, 100)}
                {firstMessagePreview.length > 100 ? '...' : ''}"
              </div>
            )}
            <div className="mt-2 text-xs text-gray-400">
              {sender.messageCount !== undefined && (
                <span className="mr-2">
                  {sender.messageCount} message{sender.messageCount !== 1 ? 's' : ''}
                </span>
              )}
              <span>{formatRelativeTime(sender.createdAt)}</span>
            </div>
          </div>

          {showActions && sender.status === 'pending' && (
            <div className="ml-4 flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleApprove}
                disabled={updateStatus.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBlock}
                disabled={updateStatus.isPending}
              >
                Block
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
