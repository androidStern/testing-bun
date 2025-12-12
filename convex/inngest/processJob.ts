import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

import { internal } from '../_generated/api';
import { postToCircle } from '../lib/circle';
import { AIExtractedJobSchema } from '../lib/jobSchema';
import { postSlackApproval, updateSlackApproval, verifySlackSignature } from '../lib/slack';
import { sendSms } from '../lib/twilio';
import { inngest } from './client';

import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import type { ParsedJob } from '../lib/jobSchema';
import type { SlackBlock } from '../lib/slack';
import type { JobFirstApplicantEvent, SlackApprovalClickedEvent } from './client';

// Extended handler args type with our middleware-injected convex context
interface HandlerArgs {
  event: { data: { submissionId: string; source: 'sms' | 'form' } };
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    waitForEvent: <T>(
      name: string,
      opts: { event: string; if: string; timeout: string }
    ) => Promise<T | null>;
  };
  convex: ActionCtx;
}

export const processJobSubmission = inngest.createFunction(
  { id: 'process-job-submission' },
  { event: 'job/submitted' },
  async (args): Promise<{ status: string; reason?: string; circleUrl?: string; firstApplicantReceived?: boolean }> => {
    // Cast to get our middleware-injected convex context
    const { event, step, convex } = args as unknown as HandlerArgs;
    const submissionId = event.data.submissionId as Id<'jobSubmissions'>;

    // Step 1: Get submission, fetch sender, parse with AI, and merge contact fallbacks
    const parsedJob = await step.run('parse-job', async (): Promise<ParsedJob> => {
      const submission = await convex.runQuery(internal.jobSubmissions.get, {
        id: submissionId,
      });
      if (!submission) throw new Error('Submission not found');

      // Fetch sender for contact/company fallback
      const sender = await convex.runQuery(internal.senders.get, {
        id: submission.senderId,
      });

      // AI parsing with permissive schema - may return partial data
      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: AIExtractedJobSchema,
        prompt: `Parse this job submission into structured data.

Raw submission:
${submission.rawContent}

IMPORTANT RULES:
- title: ALWAYS extract a job title (e.g., "Cook", "Driver", "Warehouse Worker"). This is required.
- description: Extract or summarize the job description from the text
- workArrangement: ONLY include if text explicitly says "remote", "on-site", "hybrid", "work from home", etc. Most jobs (especially food service, retail, healthcare) are on-site but do NOT assume - just omit this field unless specified
- salary: ONLY include if specific dollar amounts are mentioned
- location: ONLY include if city/state/address are mentioned
- contact: ONLY include if email/phone/name are explicitly in the text
- NEVER use placeholder values like "Not specified", "Unknown", or "N/A"
- For enum fields (workArrangement, employmentType), only use exact allowed values or omit`,
      });

      // Title is required - fail if AI couldn't extract it
      if (!object.title) {
        throw new Error('Could not extract job title from submission');
      }

      // Merge AI result with sender fallbacks to produce complete ParsedJob
      const mergedJob: ParsedJob = {
        title: object.title,
        description: object.description,
        location: object.location,
        workArrangement: object.workArrangement,
        employmentType: object.employmentType,
        salary: object.salary,
        skills: object.skills,
        requirements: object.requirements,
        company: {
          name: object.company?.name || sender?.company || 'Recovery-Friendly Employer',
        },
        contact: {
          name: object.contact?.name || sender?.name,
          method: object.contact?.method || (sender?.email ? 'email' : 'phone'),
          email: object.contact?.email || sender?.email,
          phone: object.contact?.phone || sender?.phone || '',
        },
      };

      // Save merged job to database
      await convex.runMutation(internal.jobSubmissions.updateParsed, {
        id: submissionId,
        parsedJob: mergedJob,
      });

      return mergedJob;
    });

    // Step 2: Post to Slack for approval
    const blocks = await step.run('post-slack-message', async (): Promise<Array<SlackBlock>> => {
      const result = await postSlackApproval({
        token: process.env.SLACK_BOT_TOKEN!,
        channel: process.env.SLACK_APPROVAL_CHANNEL!,
        submissionId,
        job: parsedJob,
      });
      return result.blocks;
    });

    // Step 3: Wait for approval (from Slack or in-app, timeout 7 days)
    // Event comes from either:
    // - Inngest webhook source (Slack button click transformed to slack/approval.clicked)
    // - sendApprovalEvent action (in-app approval)
    const approval = await step.waitForEvent<SlackApprovalClickedEvent>('wait-approval', {
      event: 'slack/approval.clicked',
      if: `async.data.approvalId == "${submissionId}"`,
      timeout: '7d',
    });

    const decision = approval?.data.decision;

    // Handle timeout
    if (!decision) {
      await step.run('handle-timeout', async (): Promise<void> => {
        await convex.runMutation(internal.jobSubmissions.deny, {
          id: submissionId,
          denyReason: 'Timed out after 7 days',
        });
      });
      return { status: 'denied', reason: 'timeout' };
    }

    // If Slack approval, verify signature and update message
    if (approval.data.slack) {
      const valid = await verifySlackSignature({
        body: approval.data._raw!,
        requestSignature: approval.data._sig!,
        requestTimestamp: Number(approval.data._ts),
        signingSecret: process.env.SLACK_SIGNING_SECRET!,
      });

      if (!valid) throw new Error('Invalid Slack signature');

      await step.run('update-slack-message', async (): Promise<void> => {
        await updateSlackApproval({
          responseUrl: approval.data.slack!.responseUrl,
          decision,
          userName: approval.data.slack!.userName,
          originalBlocks: blocks,
        });
      });
    }

    // Handle denial
    if (decision === 'denied') {
      await step.run('finalize-denial', async (): Promise<void> => {
        await convex.runMutation(internal.jobSubmissions.deny, {
          id: submissionId,
          denyReason: approval.data.denyReason ?? 'Denied',
        });
      });
      return { status: 'denied' };
    }

    // Step 4: Post to Circle
    const circleResult = await step.run('post-to-circle', async (): Promise<{ postUrl: string }> => {
      return await postToCircle({
        job: parsedJob,
        jobSubmissionId: submissionId,
        spaceId: process.env.CIRCLE_SPACE_ID!,
        apiToken: process.env.CIRCLE_API_TOKEN!,
        appBaseUrl: process.env.APP_BASE_URL || 'https://recoveryjobs.com',
      });
    });

    // Step 5: Finalize approval
    await step.run('finalize-approval', async (): Promise<void> => {
      await convex.runMutation(internal.jobSubmissions.approve, {
        id: submissionId,
        approvedBy: approval.data.slack?.userName ?? approval.data.approvedBy,
        circlePostUrl: circleResult.postUrl,
      });
    });

    // Step 6: Wait for first applicant (no timeout - wait indefinitely until job is closed)
    // This event is sent by processApplication workflow when isFirstApplicant=true
    const firstApplicant = await step.waitForEvent<JobFirstApplicantEvent>(
      'wait-first-applicant',
      {
        event: 'job/first-applicant',
        if: `async.data.jobSubmissionId == "${submissionId}"`,
        timeout: '90d', // Long timeout - job auto-closes after ~3 months if no applicants
      }
    );

    // Step 7: Notify poster about first applicant
    if (firstApplicant) {
      await step.run('notify-poster', async (): Promise<void> => {
        // Get sender phone for SMS
        const submission = await convex.runQuery(internal.jobSubmissions.get, {
          id: submissionId,
        });
        if (!submission) return;

        const sender = await convex.runQuery(internal.senders.get, {
          id: submission.senderId,
        });
        if (!sender?.phone) return;

        // Generate magic link token for employer setup
        // Token contains: submissionId, senderId, expiry (7d)
        const token = Buffer.from(
          JSON.stringify({
            submissionId,
            senderId: submission.senderId,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          })
        ).toString('base64url');

        const setupUrl = `${process.env.APP_BASE_URL || 'https://recoveryjobs.com'}/employer/setup?token=${token}`;

        // Send SMS via Twilio
        const smsBody = `Someone is interested in your ${parsedJob.title} job! Set up your account to view applicants: ${setupUrl}\n\nReply STOP to close this job posting.`;

        const smsResult = await sendSms({
          to: sender.phone,
          body: smsBody,
        });

        console.log(`First applicant notification sent to ${sender.phone}, SID: ${smsResult.messageSid}`);
      });
    }

    return {
      status: 'approved',
      circleUrl: circleResult.postUrl,
      firstApplicantReceived: !!firstApplicant,
    };
  }
);
