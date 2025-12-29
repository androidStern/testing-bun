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

// Application submitted - triggers application workflow
type ApplicationSubmittedEvent = {
  name: 'application/submitted';
  data: {
    applicationId: string;
    jobSubmissionId: string;
    seekerProfileId: string;
    isFirstApplicant: boolean;
  };
};

// First applicant for a job - sent by application workflow, received by job workflow
type JobFirstApplicantEvent = {
  name: 'job/first-applicant';
  data: {
    jobSubmissionId: string;
    applicationId: string;
  };
};

// Employer approved - admin approved employer account (Checkpoint 3)
type EmployerApprovedEvent = {
  name: 'employer/approved';
  data: {
    employerId: string;
    approvedBy: string;
  };
};

// Employer account created - employer filled out signup form
type EmployerAccountCreatedEvent = {
  name: 'employer/account-created';
  data: {
    employerId: string;
    senderId: string;
    jobSubmissionId: string;
  };
};

// Isochrones compute - triggered when user sets home location
type IsochronesComputeEvent = {
  name: 'isochrones/compute';
  data: {
    profileId: string; // Convex ID serialized
    lat: number;
    lon: number;
  };
};

type Events = {
  'job/submitted': JobSubmittedEvent;
  'slack/approval.clicked': SlackApprovalClickedEvent;
  'application/submitted': ApplicationSubmittedEvent;
  'job/first-applicant': JobFirstApplicantEvent;
  'employer/approved': EmployerApprovedEvent;
  'employer/account-created': EmployerAccountCreatedEvent;
  'isochrones/compute': IsochronesComputeEvent;
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

export type {
  JobSubmittedEvent,
  SlackApprovalClickedEvent,
  ApplicationSubmittedEvent,
  JobFirstApplicantEvent,
  EmployerApprovedEvent,
  EmployerAccountCreatedEvent,
  IsochronesComputeEvent,
  Events,
};
