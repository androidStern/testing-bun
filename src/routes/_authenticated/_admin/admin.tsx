import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '../../../../convex/_generated/api';
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
  loader: async ({ context }) => {
    // Preload ALL tab data in parallel - useSuspenseQuery won't suspend since data is cached
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.senders.list, { status: 'pending' }),
      ),
      context.queryClient.ensureQueryData(convexQuery(api.senders.list, {})),
      context.queryClient.ensureQueryData(
        convexQuery(api.inboundMessages.list, { status: 'pending_review' }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.inboundMessages.list, {}),
      ),
    ]);
  },
});

function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-bold">SMS Admin Dashboard</h1>

      <Tabs defaultValue="pending-senders">
        <TabsList className="mb-6">
          <TabsTrigger value="pending-senders">Pending Senders</TabsTrigger>
          <TabsTrigger value="all-senders">All Senders</TabsTrigger>
          <TabsTrigger value="pending-messages">Pending Messages</TabsTrigger>
          <TabsTrigger value="all-messages">All Messages</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}

function PendingSendersTab() {
  const { data: senders } = useSuspenseQuery(
    convexQuery(api.senders.list, { status: 'pending' }),
  );

  if (!senders?.length) {
    return <div className="text-gray-500">No pending senders</div>;
  }

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
  const { data: senders } = useSuspenseQuery(
    convexQuery(api.senders.list, {}),
  );

  if (!senders?.length) {
    return <div className="text-gray-500">No senders yet</div>;
  }

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
  const { data: messages } = useSuspenseQuery(
    convexQuery(api.inboundMessages.list, { status: 'pending_review' }),
  );

  if (!messages?.length) {
    return <div className="text-gray-500">No pending messages</div>;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageCard key={message._id} message={message} showActions />
      ))}
    </div>
  );
}

function AllMessagesTab() {
  const { data: messages } = useSuspenseQuery(
    convexQuery(api.inboundMessages.list, {}),
  );

  if (!messages?.length) {
    return <div className="text-gray-500">No messages yet</div>;
  }

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

