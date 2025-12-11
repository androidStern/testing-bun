import {
  EventSchemas,
  Inngest,
  InngestCommHandler,
  InngestMiddleware,
  type ServeHandlerOptions,
} from 'inngest';

import type { ActionCtx } from '../_generated/server';

// Define event schemas for type safety
type JobSubmittedEvent = {
  name: 'job/submitted';
  data: {
    submissionId: string;
    source: 'sms' | 'form';
  };
};

type JobDecisionEvent = {
  name: 'job/decision';
  data: {
    submissionId: string;
    decision: 'approved' | 'denied';
    // Slack approval fields (present when approved via Slack)
    slack?: {
      responseUrl: string;
      userName: string;
    };
    // Signature verification (for Slack)
    _raw?: string;
    _sig?: string;
    _ts?: string;
    // In-app approval fields
    approvedBy?: string;
    denyReason?: string;
  };
};

type Events = {
  'job/submitted': JobSubmittedEvent;
  'job/decision': JobDecisionEvent;
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

// Custom serve handler that accepts (Request, ActionCtx)
export function createConvexServe(options: Pick<ServeHandlerOptions, 'client' | 'functions'>) {
  const handler = new InngestCommHandler<[Request, ActionCtx], Response>({
    frameworkName: 'convex',
    client: options.client,
    functions: options.functions,
    handler: (req: Request, _ctx: ActionCtx) => ({
      body: () => req.json(),
      headers: (key: string) => req.headers.get(key),
      method: () => req.method,
      url: () => new URL(req.url, `https://${req.headers.get('host') || 'localhost'}`),
      transformResponse: (res: { body: string; status: number; headers: Record<string, string> }) =>
        new Response(res.body, { status: res.status, headers: res.headers }),
    }),
  });

  return handler.createHandler();
}

export type { JobSubmittedEvent, JobDecisionEvent, Events };
