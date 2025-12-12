import { internal } from '../_generated/api';
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
  async (args): Promise<{ status: string; notifiedPoster?: boolean }> => {
    // Cast to get our middleware-injected convex context
    const { event, step, convex } = args as unknown as HandlerArgs;
    const {
      applicationId,
      jobSubmissionId,
      seekerProfileId,
      isFirstApplicant,
    } = event.data;

    // Step 1: Get application and job details for logging
    const details = await step.run('get-details', async () => {
      const application = await convex.runQuery(internal.applications.get, {
        id: applicationId as Id<'applications'>,
      });
      const job = await convex.runQuery(internal.jobSubmissions.get, {
        id: jobSubmissionId as Id<'jobSubmissions'>,
      });

      return {
        applicationExists: !!application,
        jobTitle: job?.parsedJob?.title ?? 'Unknown',
        companyName: job?.parsedJob?.company.name ?? 'Unknown',
        senderId: job?.senderId,
      };
    });

    // Step 2: If first applicant, send event to job workflow
    if (isFirstApplicant && details.senderId) {
      await step.run('notify-first-applicant', async () => {
        // Send event to wake up the job workflow waiting for first applicant
        await inngest.send({
          name: 'job/first-applicant',
          data: {
            jobSubmissionId,
            applicationId,
          },
        });
        console.log(
          `First applicant for job ${details.jobTitle}! Notifying poster.`
        );
      });
    }

    // Step 3: Log application (seeker confirmation handled by UI)
    await step.run('log-application', async () => {
      const count = await convex.runQuery(internal.applications.countByJob, {
        jobSubmissionId: jobSubmissionId as Id<'jobSubmissions'>,
      });
      console.log(
        `Application #${count} for ${details.jobTitle} at ${details.companyName}`
      );
    });

    return {
      status: 'completed',
      notifiedPoster: isFirstApplicant,
    };
  }
);
