import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '../../../../convex/_generated/api';
import { EmployerCard } from '../../../components/admin/EmployerCard';
import { JobSubmissionCard } from '../../../components/admin/JobSubmissionCard';
import { MessageCard } from '../../../components/admin/MessageCard';
import { SenderCard } from '../../../components/admin/SenderCard';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/tabs';

export const Route = createFileRoute('/_authenticated/_admin/admin')({
  component: AdminDashboard,
  // No loader - let queries run in components with loading states
  // This avoids the SSR/hydration auth race condition
});

function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-bold">SMS Admin Dashboard</h1>

      <Tabs defaultValue="pending-jobs">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="pending-jobs">Pending Jobs</TabsTrigger>
          <TabsTrigger value="all-jobs">All Jobs</TabsTrigger>
          <TabsTrigger value="pending-senders">Pending Senders</TabsTrigger>
          <TabsTrigger value="all-senders">All Senders</TabsTrigger>
          <TabsTrigger value="pending-messages">Pending Messages</TabsTrigger>
          <TabsTrigger value="all-messages">All Messages</TabsTrigger>
          <TabsTrigger value="pending-employers">Pending Employers</TabsTrigger>
          <TabsTrigger value="all-employers">All Employers</TabsTrigger>
        </TabsList>

        <TabsContent value="pending-jobs">
          <PendingJobsTab />
        </TabsContent>

        <TabsContent value="all-jobs">
          <AllJobsTab />
        </TabsContent>

        <TabsContent value="pending-senders">
          <PendingSendersTab />
        </TabsContent>

        <TabsContent value="all-senders">
          <AllSendersTab />
        </TabsContent>

        <TabsContent value="pending-messages">
          <PendingMessagesTab />
        </TabsContent>

        <TabsContent value="all-messages">
          <AllMessagesTab />
        </TabsContent>

        <TabsContent value="pending-employers">
          <PendingEmployersTab />
        </TabsContent>

        <TabsContent value="all-employers">
          <AllEmployersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PendingJobsTab() {
  const { data: jobs, isLoading, error } = useQuery(
    convexQuery(api.jobSubmissions.list, { status: 'pending_approval' }),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading jobs</div>;
  if (!jobs?.length) return <div className="text-gray-500">No pending jobs</div>;

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobSubmissionCard key={job._id} job={job} showActions />
      ))}
    </div>
  );
}

function AllJobsTab() {
  const { data: jobs, isLoading, error } = useQuery(
    convexQuery(api.jobSubmissions.list, {}),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading jobs</div>;
  if (!jobs?.length) return <div className="text-gray-500">No jobs yet</div>;

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobSubmissionCard
          key={job._id}
          job={job}
          showActions={job.status === 'pending_approval'}
        />
      ))}
    </div>
  );
}

function PendingSendersTab() {
  const { data: senders, isLoading, error } = useQuery(
    convexQuery(api.senders.list, { status: 'pending' }),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading senders</div>;
  if (!senders?.length) return <div className="text-gray-500">No pending senders</div>;

  return (
    <div className="space-y-4">
      {senders.map((sender) => (
        <SenderCard
          key={sender._id}
          sender={sender as any}
          firstMessagePreview={sender.firstMessagePreview ?? undefined}
          showActions
        />
      ))}
    </div>
  );
}

function AllSendersTab() {
  const { data: senders, isLoading, error } = useQuery(
    convexQuery(api.senders.list, {}),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading senders</div>;
  if (!senders?.length) return <div className="text-gray-500">No senders yet</div>;

  return (
    <div className="space-y-4">
      {senders.map((sender) => (
        <SenderCard
          key={sender._id}
          sender={sender as any}
          firstMessagePreview={sender.firstMessagePreview ?? undefined}
          showActions={sender.status === 'pending'}
        />
      ))}
    </div>
  );
}

function PendingMessagesTab() {
  const { data: messages, isLoading, error } = useQuery(
    convexQuery(api.inboundMessages.list, { status: 'pending_review' }),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading messages</div>;
  if (!messages?.length) return <div className="text-gray-500">No pending messages</div>;

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageCard key={message._id} message={message} showActions />
      ))}
    </div>
  );
}

function AllMessagesTab() {
  const { data: messages, isLoading, error } = useQuery(
    convexQuery(api.inboundMessages.list, {}),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading messages</div>;
  if (!messages?.length) return <div className="text-gray-500">No messages yet</div>;

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageCard
          key={message._id}
          message={message}
          showActions={
            message.status === 'pending_review' || message.status === 'approved'
          }
        />
      ))}
    </div>
  );
}

function PendingEmployersTab() {
  const { data: employers, isLoading, error } = useQuery(
    convexQuery(api.employers.list, { status: 'pending_review' as const }),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading employers</div>;
  if (!employers?.length) return <div className="text-gray-500">No pending employer accounts</div>;

  return (
    <div className="space-y-4">
      {employers.map((employer) => (
        <EmployerCard
          key={employer._id}
          employer={employer as any}
          showActions
        />
      ))}
    </div>
  );
}

function AllEmployersTab() {
  const { data: employers, isLoading, error } = useQuery(
    convexQuery(api.employers.list, {}),
  );

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-500">Error loading employers</div>;
  if (!employers?.length) return <div className="text-gray-500">No employer accounts yet</div>;

  return (
    <div className="space-y-4">
      {employers.map((employer) => (
        <EmployerCard
          key={employer._id}
          employer={employer as any}
          showActions={employer.status === 'pending_review'}
        />
      ))}
    </div>
  );
}

