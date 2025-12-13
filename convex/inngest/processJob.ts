import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

import { internal } from '../_generated/api';
import { postToCircle } from '../lib/circle';
import { AIExtractedJobSchema } from '../lib/jobSchema';
import { postSlackApproval, verifySlackSignature } from '../lib/slack';
import { inngest } from './client';

import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import type { ParsedJob } from '../lib/jobSchema';
import type { SlackBlock } from '../lib/slack';
import type { SlackApprovalClickedEvent } from './client';

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
  async (args): Promise<{ status: string; reason?: string; circleUrl?: string }> => {
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

    // Step 2: Post to Slack for approval and store message reference
    const blocks = await step.run('post-slack-message', async (): Promise<Array<SlackBlock>> => {
      const channel = process.env.SLACK_APPROVAL_CHANNEL!;
      const appBaseUrl = process.env.APP_BASE_URL;
      if (!appBaseUrl) {
        throw new Error('APP_BASE_URL not configured');
      }
      const result = await postSlackApproval({
        token: process.env.SLACK_BOT_TOKEN!,
        channel,
        submissionId,
        job: parsedJob,
        appBaseUrl,
      });

      // Store Slack message reference for later updates (e.g., when job is edited)
      await convex.runMutation(internal.jobSubmissions.updateSlackRef, {
        id: submissionId,
        slackChannel: channel,
        slackMessageTs: result.ts,
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

    // Verify Slack signature if approval came from Slack (security check)
    if (approval.data.slack) {
      const valid = await verifySlackSignature({
        body: approval.data._raw!,
        requestSignature: approval.data._sig!,
        requestTimestamp: Number(approval.data._ts),
        signingSecret: process.env.SLACK_SIGNING_SECRET!,
      });
      if (!valid) throw new Error('Invalid Slack signature');
    }

    // Update Slack message - works for BOTH Slack and Admin UI approvals
    const approverName = approval.data.slack?.userName ?? approval.data.approvedBy ?? 'Admin';
    await step.run('update-slack-message', async (): Promise<void> => {
      const submission = await convex.runQuery(internal.jobSubmissions.get, { id: submissionId });
      if (submission?.slackChannel && submission?.slackMessageTs) {
        // Build updated blocks without action buttons, with approval status
        const updatedBlocks = blocks.filter((b) => b.type !== 'actions');
        updatedBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: decision === 'approved'
              ? `*Approved* by ${approverName}`
              : `*Denied* by ${approverName}`,
          },
        });

        // Use chat.update API with stored channel/ts
        const token = process.env.SLACK_BOT_TOKEN;
        if (!token) {
          throw new Error('SLACK_BOT_TOKEN not configured');
        }
        const res = await fetch('https://slack.com/api/chat.update', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            channel: submission.slackChannel,
            ts: submission.slackMessageTs,
            text: `Job ${decision}: ${parsedJob.title}`,
            blocks: updatedBlocks,
          }),
        });
        if (!res.ok) {
          throw new Error(`Slack chat.update failed: ${res.status} ${await res.text()}`);
        }
        const responseBody = (await res.json()) as { ok: boolean; error?: string };
        if (!responseBody.ok) {
          throw new Error(`Slack API error: ${responseBody.error}`);
        }
      }
    });

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
      const circleAppBaseUrl = process.env.APP_BASE_URL;
      if (!circleAppBaseUrl) {
        throw new Error('APP_BASE_URL not configured');
      }
      return await postToCircle({
        job: parsedJob,
        jobSubmissionId: submissionId,
        spaceId: process.env.CIRCLE_SPACE_ID!,
        apiToken: process.env.CIRCLE_API_TOKEN!,
        appBaseUrl: circleAppBaseUrl,
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

    // Note: Poster notifications are now handled by processApplication workflow
    // which notifies on EVERY application (first and subsequent)

    return {
      status: 'approved',
      circleUrl: circleResult.postUrl,
    };
  }
);
