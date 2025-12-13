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
        const token = createToken(jobSubmissionId, details.senderId);
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
          body = `Great news! A candidate has applied to your job posting.

Position: ${details.jobTitle}
Company: ${details.companyName}

${details.employerStatus === 'approved'
  ? `View your applicants:\n${url}`
  : `Complete your account to connect with candidates:\n${url}`
}

--
Recovery Jobs`;
        } else {
          subject = `Another applicant for your ${details.jobTitle} position!`;
          body = `You have a new applicant!

Position: ${details.jobTitle}
Total applicants: ${details.applicationCount}

${details.employerStatus === 'approved'
  ? `View all applicants:\n${url}`
  : details.employerStatus === 'pending_review'
    ? `Your account is under review. Once approved, you can view applicants:\n${url}`
    : `Complete your account to view applicants:\n${url}`
}

--
Recovery Jobs`;
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
        const token = createToken(jobSubmissionId, details.senderId);
        const appBaseUrl = process.env.APP_BASE_URL;
        if (!appBaseUrl) {
          throw new Error('APP_BASE_URL not configured');
        }

        const url = `${appBaseUrl}/employer/candidates?token=${token}`;

        await convex.runAction(internal.inngestNode.sendEmail, {
          to: details.senderEmail!,
          subject: 'Your employer account is approved!',
          body: `Great news!

Your Recovery Jobs employer account has been approved.

${details.seekerName} applied to your ${details.jobTitle} position.

View candidate: ${url}

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
