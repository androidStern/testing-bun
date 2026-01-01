import { useMutation } from 'convex/react';
import { useState } from 'react';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface Employer {
  _id: Id<'employers'>;
  name: string;
  email: string;
  phone: string;
  company: string;
  role?: string;
  website?: string;
  status: 'pending_review' | 'approved' | 'rejected';
  createdAt: number;
  approvedAt?: number;
  approvedBy?: string;
}

interface EmployerCardProps {
  employer: Employer;
  showActions?: boolean;
}

export function EmployerCard({ employer, showActions }: EmployerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: employer.name,
    email: employer.email,
    phone: employer.phone,
    company: employer.company,
    role: employer.role || '',
    website: employer.website || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const approveMutation = useMutation(api.employers.approve);
  const rejectMutation = useMutation(api.employers.reject);
  const deleteMutation = useMutation(api.employers.deleteEmployer);
  const adminUpdateMutation = useMutation(api.employers.adminUpdate);

  const statusColors: Record<string, string> = {
    pending_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  const handleApprove = async () => {
    if (confirm('Approve this employer account? They will be able to view candidates.')) {
      await approveMutation({ employerId: employer._id });
    }
  };

  const handleReject = async () => {
    if (confirm('Reject this employer account?')) {
      await rejectMutation({ employerId: employer._id });
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete employer account for ${employer.name}?\n\nThis cannot be undone.`)) {
      await deleteMutation({ employerId: employer._id });
    }
  };

  const handleEdit = () => {
    setEditValues({
      name: employer.name,
      email: employer.email,
      phone: employer.phone,
      company: employer.company,
      role: employer.role || '',
      website: employer.website || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await adminUpdateMutation({
        id: employer._id,
        patch: {
          name: editValues.name,
          email: editValues.email,
          phone: editValues.phone,
          company: editValues.company,
          role: editValues.role || undefined,
          website: editValues.website || undefined,
        },
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusColors[employer.status] || 'bg-muted text-foreground'
              }`}
            >
              {employer.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-muted-foreground">Editing</span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <Input
                type="text"
                value={editValues.name}
                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                className="mt-1"
                placeholder="Name"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={editValues.email}
                onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                className="mt-1"
                placeholder="Email"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Phone</Label>
              <Input
                type="tel"
                value={editValues.phone}
                onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                className="mt-1"
                placeholder="Phone"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Company</Label>
              <Input
                type="text"
                value={editValues.company}
                onChange={(e) => setEditValues({ ...editValues, company: e.target.value })}
                className="mt-1"
                placeholder="Company"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <Input
                type="text"
                value={editValues.role}
                onChange={(e) => setEditValues({ ...editValues, role: e.target.value })}
                className="mt-1"
                placeholder="Role"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Website</Label>
              <Input
                type="url"
                value={editValues.website}
                onChange={(e) => setEditValues({ ...editValues, website: e.target.value })}
                className="mt-1"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{employer.name}</h3>
            <p className="text-sm text-muted-foreground">{employer.company}</p>
            {employer.role && (
              <p className="text-sm text-muted-foreground">{employer.role}</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusColors[employer.status] || 'bg-muted text-foreground'
            }`}
          >
            {employer.status.replace('_', ' ')}
          </span>
        </div>

        <div className="mb-3 space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Email:</span>{' '}
            <a href={`mailto:${employer.email}`} className="text-primary hover:underline">
              {employer.email}
            </a>
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span>{' '}
            <a href={`tel:${employer.phone}`} className="text-primary hover:underline">
              {employer.phone}
            </a>
          </p>
          {employer.website && (
            <p>
              <span className="text-muted-foreground">Website:</span>{' '}
              <a
                href={employer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {employer.website}
              </a>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Created: {new Date(employer.createdAt).toLocaleString()}
          </p>
          {employer.approvedAt && (
            <p className="text-xs text-muted-foreground">
              Approved: {new Date(employer.approvedAt).toLocaleString()}
              {employer.approvedBy && ` by ${employer.approvedBy}`}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {showActions && employer.status === 'pending_review' && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReject}
              >
                Reject
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
