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
  };
  convex: ActionCtx;
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

    // Step 1: Get job, sender, employer, and application count
    const details = await step.run('get-details', async () => {
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

      return {
        jobTitle: job.parsedJob?.title ?? 'Unknown',
        companyName: job.parsedJob?.company.name ?? 'Unknown',
        senderId: job.senderId,
        senderEmail: sender?.email,
        senderPhone: sender?.phone,
        employerStatus: employer?.status as 'pending_review' | 'approved' | 'rejected' | undefined,
        applicationCount,
      };
    });

    // Step 2: Notify poster about this application
    let notifiedPoster = false;
    if (details.senderEmail) {
      await step.run('notify-poster', async () => {
        const token = createToken(jobSubmissionId, details.senderId);
        const appBaseUrl = process.env.APP_BASE_URL || 'https://recovery-jobs.com';

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
      console.warn(
        `Cannot notify poster for job ${details.jobTitle}: no email on file for sender ${details.senderId}`
      );
    }

    return {
      status: 'completed',
      notifiedPoster,
    };
  }
);
