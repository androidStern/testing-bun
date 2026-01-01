import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);

  const updateStatus = useMutation({
    mutationFn: useConvexMutation(api.inboundMessages.updateStatus),
  });

  const deleteMessage = useMutation({
    mutationFn: useConvexMutation(api.inboundMessages.deleteMessage),
  });

  const adminUpdate = useMutation({
    mutationFn: useConvexMutation(api.inboundMessages.adminUpdate),
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

  const handleEdit = () => {
    setEditBody(message.body);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    adminUpdate.mutate(
      {
        id: message._id,
        patch: { body: editBody },
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const isPending = updateStatus.isPending || deleteMessage.isPending || adminUpdate.isPending;

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{message.phone}</span>
              <StatusBadge status={message.status} />
              <span className="text-xs text-muted-foreground">Editing</span>
            </div>
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={4}
              placeholder="Message body"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                {adminUpdate.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{message.phone}</span>
              <StatusBadge status={message.status} />
              {message.sender && (
                <span className="text-xs text-muted-foreground">
                  ({message.sender.name || message.sender.company || 'Unknown'})
                </span>
              )}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {message.body}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {formatRelativeTime(message.createdAt)}
            </div>
          </div>

          <div className="ml-4 flex flex-wrap gap-2">
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
              onClick={handleEdit}
              disabled={isPending}
            >
              Edit
            </Button>
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
