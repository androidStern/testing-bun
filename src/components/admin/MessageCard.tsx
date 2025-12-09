import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

import { StatusBadge } from './StatusBadge';

interface MessageCardProps {
  message: {
    _id: Id<'inboundMessages'>;
    phone: string;
    body: string;
    status: string;
    createdAt: number;
    sender?: {
      name?: string;
      company?: string;
      status: string;
    } | null;
  };
  showActions?: boolean;
}

export function MessageCard({ message, showActions = false }: MessageCardProps) {
  const updateStatus = useMutation({
    mutationFn: useConvexMutation(api.inboundMessages.updateStatus),
  });

  const handleApprove = () => {
    updateStatus.mutate({ messageId: message._id, status: 'approved' });
  };

  const handleReject = () => {
    updateStatus.mutate({ messageId: message._id, status: 'rejected' });
  };

  const handleMarkProcessed = () => {
    updateStatus.mutate({ messageId: message._id, status: 'processed' });
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{message.phone}</span>
              <StatusBadge status={message.status} />
              {message.sender && (
                <span className="text-xs text-gray-500">
                  ({message.sender.name || message.sender.company || 'Unknown'})
                </span>
              )}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {message.body}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {formatRelativeTime(message.createdAt)}
            </div>
          </div>

          {showActions && message.status === 'pending_review' && (
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
                onClick={handleReject}
                disabled={updateStatus.isPending}
              >
                Reject
              </Button>
            </div>
          )}

          {showActions && message.status === 'approved' && (
            <div className="ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkProcessed}
                disabled={updateStatus.isPending}
              >
                Mark Processed
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
