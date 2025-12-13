import { useMutation } from 'convex/react';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

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
  const approveMutation = useMutation(api.employers.approve);
  const rejectMutation = useMutation(api.employers.reject);
  const deleteMutation = useMutation(api.employers.deleteEmployer);

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

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{employer.name}</h3>
          <p className="text-sm text-gray-600">{employer.company}</p>
          {employer.role && (
            <p className="text-sm text-gray-500">{employer.role}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusColors[employer.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {employer.status.replace('_', ' ')}
        </span>
      </div>

      <div className="mb-3 space-y-1 text-sm">
        <p>
          <span className="text-gray-500">Email:</span>{' '}
          <a href={`mailto:${employer.email}`} className="text-blue-600 hover:underline">
            {employer.email}
          </a>
        </p>
        <p>
          <span className="text-gray-500">Phone:</span>{' '}
          <a href={`tel:${employer.phone}`} className="text-blue-600 hover:underline">
            {employer.phone}
          </a>
        </p>
        {employer.website && (
          <p>
            <span className="text-gray-500">Website:</span>{' '}
            <a
              href={employer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {employer.website}
            </a>
          </p>
        )}
        <p className="text-xs text-gray-400">
          Created: {new Date(employer.createdAt).toLocaleString()}
        </p>
        {employer.approvedAt && (
          <p className="text-xs text-gray-400">
            Approved: {new Date(employer.approvedAt).toLocaleString()}
            {employer.approvedBy && ` by ${employer.approvedBy}`}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {showActions && employer.status === 'pending_review' && (
          <>
            <button
              onClick={handleApprove}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve
            </button>
            <button
              onClick={handleReject}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Reject
            </button>
          </>
        )}
        <button
          onClick={handleDelete}
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
