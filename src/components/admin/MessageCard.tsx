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

  const deleteMessage = useMutation({
    mutationFn: useConvexMutation(api.inboundMessages.deleteMessage),
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

  const handleDelete = () => {
    if (confirm('Delete this message?\n\nThis cannot be undone.')) {
      deleteMessage.mutate({ messageId: message._id });
    }
  };

  const isPending = updateStatus.isPending || deleteMessage.isPending;

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

          <div className="ml-4 flex gap-2">
            {showActions && message.status === 'pending_review' && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isPending}
                >
                  Reject
                </Button>
              </>
            )}

            {showActions && message.status === 'approved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkProcessed}
                disabled={isPending}
              >
                Mark Processed
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
