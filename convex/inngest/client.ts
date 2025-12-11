import { EventSchemas, Inngest, InngestMiddleware } from 'inngest';

import type { ActionCtx } from '../_generated/server';

// Define event schemas for type safety
type JobSubmittedEvent = {
  name: 'job/submitted';
  data: {
    submissionId: string;
    source: 'sms' | 'form';
  };
};

// Slack approval event - received from Inngest webhook source
// Transform function in Inngest dashboard converts Slack button click to this format
type SlackApprovalClickedEvent = {
  name: 'slack/approval.clicked';
  data: {
    approvalId: string; // = submissionId
    decision: 'approved' | 'denied';
    // Slack-specific fields (present when from Slack webhook)
    slack?: {
      responseUrl: string;
      userName: string;
    };
    // Signature verification (from Slack headers)
    _raw?: string;
    _sig?: string;
    _ts?: string;
    // In-app approval fields (present when from in-app)
    approvedBy?: string;
    denyReason?: string;
  };
};

type Events = {
  'job/submitted': JobSubmittedEvent;
  'slack/approval.clicked': SlackApprovalClickedEvent;
};

// Middleware to inject Convex ActionCtx into Inngest function context
const convexMiddleware = new InngestMiddleware({
  name: 'Convex context',
  init: () => ({
    onFunctionRun: ({ reqArgs }) => ({
      transformInput: () => ({
        ctx: {
          convex: (reqArgs as [Request, ActionCtx])[1],
        },
      }),
    }),
  }),
});

export const inngest = new Inngest({
  id: 'recovery-jobs',
  schemas: new EventSchemas().fromRecord<Events>(),
  middleware: [convexMiddleware],
});

export type { JobSubmittedEvent, SlackApprovalClickedEvent, Events };
