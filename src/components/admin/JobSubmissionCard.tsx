import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { ParsedJobSchema } from '../../../convex/lib/jobSchema';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

import { StatusBadge } from './StatusBadge';

type JobSubmission = Doc<'jobSubmissions'> & {
  sender: {
    _id: Id<'senders'>;
    phone?: string;
    email?: string;
    name?: string;
    company?: string;
    status: string;
  } | null;
};

interface JobSubmissionCardProps {
  job: JobSubmission;
  showActions?: boolean;
}

export function JobSubmissionCard({ job, showActions = false }: JobSubmissionCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const approveFromUI = useMutation({
    mutationFn: useConvexMutation(api.jobSubmissions.approveFromUI),
  });

  const denyFromUI = useMutation({
    mutationFn: useConvexMutation(api.jobSubmissions.denyFromUI),
  });

  const adminUpdateParsedJob = useMutation({
    mutationFn: useConvexMutation(api.jobSubmissions.adminUpdateParsedJob),
  });

  const form = useForm({
    defaultValues: {
      title: job.parsedJob?.title || '',
      description: job.parsedJob?.description || '',
      companyName: job.parsedJob?.company?.name || '',
      contactName: job.parsedJob?.contact?.name || '',
      contactEmail: job.parsedJob?.contact?.email || '',
      contactPhone: job.parsedJob?.contact?.phone || '',
      contactMethod: (job.parsedJob?.contact?.method || 'phone') as 'email' | 'phone',
      locationCity: job.parsedJob?.location?.city || '',
      locationState: job.parsedJob?.location?.state || '',
      workArrangement: (job.parsedJob?.workArrangement || '') as '' | 'remote' | 'on-site' | 'hybrid',
      employmentType: (job.parsedJob?.employmentType || '') as '' | 'full-time' | 'part-time' | 'contract' | 'internship' | 'temporary',
      salaryMin: job.parsedJob?.salary?.min?.toString() || '',
      salaryMax: job.parsedJob?.salary?.max?.toString() || '',
      salaryUnit: (job.parsedJob?.salary?.unit || '') as '' | 'hr' | 'day' | 'week' | 'month' | 'year' | 'job',
      skills: job.parsedJob?.skills?.join(', ') || '',
      requirements: job.parsedJob?.requirements?.join(', ') || '',
    },
    onSubmit: async ({ value }) => {
      const parsedJob = {
        title: value.title,
        description: value.description || undefined,
        company: {
          name: value.companyName,
        },
        contact: {
          name: value.contactName || undefined,
          email: value.contactEmail || undefined,
          phone: value.contactPhone,
          method: value.contactMethod,
        },
        location: value.locationCity || value.locationState
          ? {
              city: value.locationCity || undefined,
              state: value.locationState || undefined,
            }
          : undefined,
        workArrangement: value.workArrangement || undefined,
        employmentType: value.employmentType || undefined,
        salary:
          value.salaryMin || value.salaryMax
            ? {
                min: value.salaryMin ? parseInt(value.salaryMin, 10) : undefined,
                max: value.salaryMax ? parseInt(value.salaryMax, 10) : undefined,
                unit: value.salaryUnit || undefined,
              }
            : undefined,
        skills: value.skills ? value.skills.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        requirements: value.requirements
          ? value.requirements.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
      };

      // Validate with Zod schema
      const result = ParsedJobSchema.safeParse(parsedJob);
      if (!result.success) {
        console.error('Validation failed:', result.error);
        return;
      }

      await adminUpdateParsedJob.mutateAsync({
        id: job._id,
        parsedJob: result.data,
      });
      setIsEditing(false);
    },
  });

  const handleApprove = () => {
    if (confirm('Approve this job? It will be posted to Circle.')) {
      approveFromUI.mutate({ submissionId: job._id });
    }
  };

  const handleDeny = () => {
    const reason = prompt('Reason for denial (optional):');
    denyFromUI.mutate({ submissionId: job._id, reason: reason || undefined });
  };

  const isPending = approveFromUI.isPending || denyFromUI.isPending || adminUpdateParsedJob.isPending;
  const canEdit = job.status === 'pending_approval';

  const statusColors: Record<string, string> = {
    pending_parse: 'bg-blue-100 text-blue-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    denied: 'bg-red-100 text-red-800',
    closed: 'bg-muted text-foreground',
  };

  if (isEditing && job.parsedJob) {
    return (
      <Card>
        <CardContent className="pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  statusColors[job.status] || 'bg-muted text-foreground'
                }`}
              >
                {job.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-muted-foreground">Editing Job</span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-muted-foreground">Title *</Label>
                <form.Field name="title">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Job title"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div className="col-span-2">
                <Label className="text-muted-foreground">Description</Label>
                <form.Field name="description">
                  {(field) => (
                    <Textarea
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Job description"
                      className="mt-1"
                      rows={3}
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Company *</Label>
                <form.Field name="companyName">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Company name"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Contact Name</Label>
                <form.Field name="contactName">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Contact name"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Contact Email</Label>
                <form.Field name="contactEmail">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="email@example.com"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Contact Phone</Label>
                <form.Field name="contactPhone">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Phone number"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Contact Method</Label>
                <form.Field name="contactMethod">
                  {(field) => (
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value as 'email' | 'phone')}
                      className="mt-1 w-full border px-3 py-2 text-sm bg-background"
                    >
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                    </select>
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">City</Label>
                <form.Field name="locationCity">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="City"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">State</Label>
                <form.Field name="locationState">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="State"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Work Arrangement</Label>
                <form.Field name="workArrangement">
                  {(field) => (
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value as '' | 'remote' | 'on-site' | 'hybrid')}
                      className="mt-1 w-full border px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Not specified</option>
                      <option value="remote">Remote</option>
                      <option value="on-site">On-site</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Employment Type</Label>
                <form.Field name="employmentType">
                  {(field) => (
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value as any)}
                      className="mt-1 w-full border px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Not specified</option>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                      <option value="temporary">Temporary</option>
                    </select>
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Salary Min</Label>
                <form.Field name="salaryMin">
                  {(field) => (
                    <Input
                      type="number"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Min"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Salary Max</Label>
                <form.Field name="salaryMax">
                  {(field) => (
                    <Input
                      type="number"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Max"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div>
                <Label className="text-muted-foreground">Salary Unit</Label>
                <form.Field name="salaryUnit">
                  {(field) => (
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value as any)}
                      className="mt-1 w-full border px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Not specified</option>
                      <option value="hr">Per hour</option>
                      <option value="day">Per day</option>
                      <option value="week">Per week</option>
                      <option value="month">Per month</option>
                      <option value="year">Per year</option>
                      <option value="job">Per job</option>
                    </select>
                  )}
                </form.Field>
              </div>

              <div className="col-span-2">
                <Label className="text-muted-foreground">Skills (comma-separated)</Label>
                <form.Field name="skills">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="skill1, skill2, skill3"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>

              <div className="col-span-2">
                <Label className="text-muted-foreground">Requirements (comma-separated)</Label>
                <form.Field name="requirements">
                  {(field) => (
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="req1, req2, req3"
                      className="mt-1"
                    />
                  )}
                </form.Field>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {adminUpdateParsedJob.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
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
              {job.parsedJob ? (
                <span className="font-semibold">{job.parsedJob.title}</span>
              ) : (
                <span className="text-muted-foreground italic">Parsing...</span>
              )}
              <StatusBadge status={job.status} />
            </div>

            {job.parsedJob && (
              <>
                <div className="mt-1 text-sm text-muted-foreground">
                  {job.parsedJob.company.name}
                  {job.parsedJob.location?.city && (
                    <span className="text-muted-foreground">
                      {' '}
                      • {[job.parsedJob.location.city, job.parsedJob.location.state]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </div>

                {job.parsedJob.description && (
                  <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {job.parsedJob.description}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {job.parsedJob.employmentType && (
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">
                      {job.parsedJob.employmentType}
                    </span>
                  )}
                  {job.parsedJob.workArrangement && (
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">
                      {job.parsedJob.workArrangement}
                    </span>
                  )}
                  {job.parsedJob.salary && (
                    <span className="rounded bg-green-50 px-2 py-0.5 text-green-700">
                      {job.parsedJob.salary.min && job.parsedJob.salary.max
                        ? `$${job.parsedJob.salary.min} - $${job.parsedJob.salary.max}`
                        : job.parsedJob.salary.amount
                          ? `$${job.parsedJob.salary.amount}`
                          : ''}
                      {job.parsedJob.salary.unit && ` / ${job.parsedJob.salary.unit}`}
                    </span>
                  )}
                </div>

                {job.parsedJob.skills && job.parsedJob.skills.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Skills: {job.parsedJob.skills.join(', ')}
                  </div>
                )}
              </>
            )}

            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>From: {job.sender?.phone || job.sender?.email || 'Unknown'}</span>
              <span>•</span>
              <span>{formatRelativeTime(job.createdAt)}</span>
              {job.approvedAt && (
                <>
                  <span>•</span>
                  <span>Approved by {job.approvedBy}</span>
                </>
              )}
              {job.denyReason && (
                <>
                  <span>•</span>
                  <span className="text-red-500">Reason: {job.denyReason}</span>
                </>
              )}
            </div>

            {job.circlePostUrl && (
              <div className="mt-2">
                <a
                  href={job.circlePostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View on Circle →
                </a>
              </div>
            )}
          </div>

          <div className="ml-4 flex flex-wrap gap-2">
            {showActions && job.status === 'pending_approval' && (
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
                  onClick={handleDeny}
                  disabled={isPending}
                >
                  Deny
                </Button>
              </>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
