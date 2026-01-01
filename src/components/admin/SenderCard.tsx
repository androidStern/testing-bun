import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';

import { StatusBadge } from './StatusBadge';

interface SenderCardProps {
  sender: {
    _id: Id<'senders'>;
    phone?: string;
    email?: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    phone: sender.phone || '',
    email: sender.email || '',
    name: sender.name || '',
    company: sender.company || '',
    notes: sender.notes || '',
  });

  const updateStatus = useMutation({
    mutationFn: useConvexMutation(api.senders.updateStatus),
  });

  const adminUpdate = useMutation({
    mutationFn: useConvexMutation(api.senders.adminUpdate),
  });

  const deleteSender = useMutation({
    mutationFn: useConvexMutation(api.senders.deleteSender),
  });

  const handleApprove = () => {
    updateStatus.mutate({ senderId: sender._id, status: 'approved' });
  };

  const handleBlock = () => {
    updateStatus.mutate({ senderId: sender._id, status: 'blocked' });
  };

  const handleDelete = () => {
    const messageInfo = sender.messageCount
      ? `${sender.messageCount} message(s)`
      : 'messages';
    const identifier = sender.phone || sender.email || 'this sender';
    if (
      confirm(
        `Delete sender ${identifier}?\n\nThis will also delete:\n- All ${messageInfo}\n- Any job postings\n- Any applications\n- Employer account (if exists)\n\nThis cannot be undone.`
      )
    ) {
      deleteSender.mutate({ senderId: sender._id });
    }
  };

  const handleEdit = () => {
    setEditValues({
      phone: sender.phone || '',
      email: sender.email || '',
      name: sender.name || '',
      company: sender.company || '',
      notes: sender.notes || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    adminUpdate.mutate(
      {
        id: sender._id,
        patch: {
          phone: editValues.phone || undefined,
          email: editValues.email || undefined,
          name: editValues.name || undefined,
          company: editValues.company || undefined,
          notes: editValues.notes || undefined,
        },
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const isPending = updateStatus.isPending || deleteSender.isPending || adminUpdate.isPending;

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={sender.status} />
              <span className="text-xs text-muted-foreground">Editing</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <Input
                  value={editValues.phone}
                  onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                  placeholder="Phone number"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  value={editValues.email}
                  onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                  placeholder="Email address"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={editValues.name}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  placeholder="Name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <Input
                  value={editValues.company}
                  onChange={(e) => setEditValues({ ...editValues, company: e.target.value })}
                  placeholder="Company"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input
                value={editValues.notes}
                onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                placeholder="Admin notes"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
              {sender.phone && (
                <span className="font-mono font-medium">{sender.phone}</span>
              )}
              {sender.email && (
                <span className="text-sm text-muted-foreground">{sender.email}</span>
              )}
              <StatusBadge status={sender.status} />
            </div>
            {sender.name && (
              <div className="mt-1 text-sm text-muted-foreground">{sender.name}</div>
            )}
            {sender.company && (
              <div className="text-sm text-muted-foreground">{sender.company}</div>
            )}
            {sender.notes && (
              <div className="mt-1 text-xs text-muted-foreground italic">Notes: {sender.notes}</div>
            )}
            {firstMessagePreview && (
              <div className="mt-2 text-sm text-muted-foreground italic">
                "{firstMessagePreview.slice(0, 100)}
                {firstMessagePreview.length > 100 ? '...' : ''}"
              </div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              {sender.messageCount !== undefined && (
                <span className="mr-2">
                  {sender.messageCount} message{sender.messageCount !== 1 ? 's' : ''}
                </span>
              )}
              <span>{formatRelativeTime(sender.createdAt)}</span>
            </div>
          </div>

          <div className="ml-4 flex flex-wrap gap-2">
            {showActions && sender.status === 'pending' && (
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
                  onClick={handleBlock}
                  disabled={isPending}
                >
                  Block
                </Button>
              </>
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
