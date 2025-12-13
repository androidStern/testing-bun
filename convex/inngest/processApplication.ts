import { internal } from '../_generated/api';
import { createToken } from '../lib/token';
import { inngest } from './client';

import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

// Extended handler args type with our middleware-injected convex context
interface HandlerArgs {
  event: {
    data: {
      applicationId: string;
      jobSubmissionId: string;
      seekerProfileId: string;
      isFirstApplicant: boolean;
    };
  };
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    waitForEvent: <T>(
      name: string,
      opts: {
        event: string;
        if?: string;
        timeout: string;
      }
    ) => Promise<T | null>;
  };
  convex: ActionCtx;
}

type EmployerStatus = 'pending_review' | 'approved' | 'rejected' | undefined;

interface Details {
  jobTitle: string;
  companyName: string;
  senderId: string;
  senderEmail: string | undefined;
  senderPhone: string | undefined;
  employerId: string | undefined;
  employerStatus: EmployerStatus;
  applicationCount: number;
  seekerName: string;
  seekerEmail: string;
}

export const processApplication = inngest.createFunction(
  { id: 'process-application' },
  { event: 'application/submitted' },
  async (args): Promise<{ status: string; notifiedPoster: boolean }> => {
    // Cast to get our middleware-injected convex context
    const { event, step, convex } = args as unknown as HandlerArgs;
    const {
      applicationId,
      jobSubmissionId,
      seekerProfileId,
      isFirstApplicant,
    } = event.data;

    // Step 1: Get job, sender, employer, seeker, and application count
    const details = await step.run('get-details', async (): Promise<Details> => {
      const job = await convex.runQuery(internal.jobSubmissions.get, {
        id: jobSubmissionId as Id<'jobSubmissions'>,
      });
      if (!job) throw new Error('Job not found');

      const sender = await convex.runQuery(internal.senders.get, {
        id: job.senderId,
      });

      // Check if employer account exists for this sender
      const employer = await convex.runQuery(internal.employers.getBySenderId, {
        senderId: job.senderId,
      });

      const applicationCount = await convex.runQuery(internal.applications.countByJob, {
        jobSubmissionId: jobSubmissionId as Id<'jobSubmissions'>,
      });

      // Get seeker profile for candidate info
      const seekerProfile = await convex.runQuery(internal.profiles.get, {
        id: seekerProfileId as Id<'profiles'>,
      });

      const seekerName = seekerProfile?.firstName
        ? `${seekerProfile.firstName} ${seekerProfile.lastName || ''}`.trim()
        : 'A candidate';

      return {
        jobTitle: job.parsedJob?.title ?? 'Unknown',
        companyName: job.parsedJob?.company.name ?? 'Unknown',
        senderId: job.senderId,
        senderEmail: sender?.email,
        senderPhone: sender?.phone,
        employerId: employer?._id,
        employerStatus: employer?.status as EmployerStatus,
        applicationCount,
        seekerName,
        seekerEmail: seekerProfile?.email ?? '',
      };
    });

    // Step 2: Send initial notification
    let notifiedPoster = false;
    if (details.senderEmail) {
      await step.run('send-initial-email', async () => {
        const token = await createToken(jobSubmissionId, details.senderId);
        const appBaseUrl = process.env.APP_BASE_URL;
        if (!appBaseUrl) {
          throw new Error('APP_BASE_URL not configured');
        }

        // Determine which page to link to based on employer status
        const linkPath = details.employerStatus === 'approved'
          ? '/employer/candidates'
          : '/employer/setup';
        const url = `${appBaseUrl}${linkPath}?token=${token}`;

        // Build email content based on first vs subsequent application
        let subject: string;
        let body: string;

        if (isFirstApplicant) {
          subject = `Someone is interested in your ${details.jobTitle} position!`;

          if (details.employerStatus === 'approved') {
            body = `Great news! A candidate has expressed interest in your job posting.

Position: ${details.jobTitle}
Company: ${details.companyName}

You can view their profile and connect with them now:
${url}

--
Recovery Jobs`;
          } else {
            body = `Great news! A candidate has expressed interest in your job posting.

Position: ${details.jobTitle}
Company: ${details.companyName}

Here's what happens next:

1. Complete your employer profile (takes 2 minutes)
2. Our team will review your account within 24 hours
3. Once approved, we'll email you a link to view and connect with candidates

Get started now:
${url}

--
Recovery Jobs`;
          }
        } else {
          subject = `Another candidate is interested in your ${details.jobTitle} position!`;

          if (details.employerStatus === 'approved') {
            body = `You have another interested candidate!

Position: ${details.jobTitle}
Total interested: ${details.applicationCount}

View all candidates:
${url}

--
Recovery Jobs`;
          } else if (details.employerStatus === 'pending_review') {
            body = `You have another interested candidate!

Position: ${details.jobTitle}
Total interested: ${details.applicationCount}

Your account is currently under review. Once approved, we'll send you a link to view and connect with all your candidates.

--
Recovery Jobs`;
          } else {
            body = `You have another interested candidate!

Position: ${details.jobTitle}
Total interested: ${details.applicationCount}

Complete your employer profile to connect with them:
${url}

--
Recovery Jobs`;
          }
        }

        await convex.runAction(internal.inngestNode.sendEmail, {
          to: details.senderEmail!,
          subject,
          body,
        });

        console.log(
          `Application #${details.applicationCount} for ${details.jobTitle} - notified ${details.senderEmail}`
        );
      });
      notifiedPoster = true;
    } else {
      throw new Error(
        `Cannot notify poster for job ${details.jobTitle}: no email on file for sender ${details.senderId}`
      );
    }

    // Step 3: If employer not approved, wait for events and send approval notification
    // Note: rejected employers can be re-approved, so we wait for them too
    if (details.employerStatus !== 'approved') {
      let employerId = details.employerId;

      // If employer doesn't exist, wait for signup
      if (!employerId) {
        const signupEvent = await step.waitForEvent<{
          data: { employerId: string; senderId: string; jobSubmissionId: string };
        }>('wait-for-signup', {
          event: 'employer/account-created',
          if: `async.data.senderId == '${details.senderId}'`,
          timeout: '30d',
        });

        if (!signupEvent) {
          return { status: 'timeout-waiting-for-signup', notifiedPoster };
        }
        employerId = signupEvent.data.employerId;
      }

      // Wait for approval
      const approvalEvent = await step.waitForEvent<{
        data: { employerId: string; approvedBy: string };
      }>('wait-for-approval', {
        event: 'employer/approved',
        if: `async.data.employerId == '${employerId}'`,
        timeout: '30d',
      });

      if (!approvalEvent) {
        return { status: 'timeout-waiting-for-approval', notifiedPoster };
      }

      // Step 4: Send approval notification with candidate info
      await step.run('send-approval-notification', async () => {
        const token = await createToken(jobSubmissionId, details.senderId);
        const appBaseUrl = process.env.APP_BASE_URL;
        if (!appBaseUrl) {
          throw new Error('APP_BASE_URL not configured');
        }

        const url = `${appBaseUrl}/employer/candidates?token=${token}`;

        await convex.runAction(internal.inngestNode.sendEmail, {
          to: details.senderEmail!,
          subject: `You're approved! View your candidate for ${details.jobTitle}`,
          body: `Great news — your Recovery Jobs employer account has been approved!

${details.seekerName} is interested in your ${details.jobTitle} position and is waiting to hear from you.

View their profile and connect:
${url}

--
Recovery Jobs`,
        });

        console.log(
          `Sent approval notification to ${details.senderEmail} about candidate ${details.seekerName}`
        );
      });
    }

    return {
      status: 'completed',
      notifiedPoster,
    };
  }
);
