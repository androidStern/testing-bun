import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { authMutation, authQuery } from './functions';
import { parseToken } from './lib/token';

import type { Id } from './_generated/dataModel';

// Internal query for workflow to fetch application by ID
export const get = internalQuery({
  args: { id: v.id('applications') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal query to count applications for a job
export const countByJob = internalQuery({
  args: { jobSubmissionId: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_job', (q) => q.eq('jobSubmissionId', args.jobSubmissionId))
      .collect();
    return applications.length;
  },
});

// Internal query to list applications for a job (for employer candidate view)
export const listByJob = internalQuery({
  args: { jobSubmissionId: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_job', (q) => q.eq('jobSubmissionId', args.jobSubmissionId))
      .collect();

    // Enrich with seeker profile data
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const profile = await ctx.db.get(app.seekerProfileId);
        const resume = profile
          ? await ctx.db
              .query('resumes')
              .withIndex('by_workos_user_id', (q) =>
                q.eq('workosUserId', profile.workosUserId)
              )
              .first()
          : null;

        return {
          ...app,
          seeker: profile
            ? {
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                headline: profile.headline,
                bio: profile.bio,
                resumeLink: profile.resumeLink,
                linkedinUrl: profile.linkedinUrl,
              }
            : null,
          resume: resume
            ? {
                summary: resume.summary,
                workExperience: resume.workExperience,
                education: resume.education,
                skills: resume.skills,
              }
            : null,
        };
      })
    );

    // Sort by appliedAt desc
    enriched.sort((a, b) => b.appliedAt - a.appliedAt);

    return enriched;
  },
});

// Internal mutation to create application (from apply workflow)
export const create = internalMutation({
  args: {
    jobSubmissionId: v.id('jobSubmissions'),
    seekerProfileId: v.id('profiles'),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if job is still open
    const job = await ctx.db.get(args.jobSubmissionId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'approved') throw new Error('Job is not accepting applications');

    // Check for duplicate application
    const existing = await ctx.db
      .query('applications')
      .withIndex('by_job', (q) => q.eq('jobSubmissionId', args.jobSubmissionId))
      .collect();

    const duplicate = existing.find((a) => a.seekerProfileId === args.seekerProfileId);
    if (duplicate) throw new Error('Already applied to this job');

    const id = await ctx.db.insert('applications', {
      jobSubmissionId: args.jobSubmissionId,
      seekerProfileId: args.seekerProfileId,
      message: args.message,
      status: 'pending',
      appliedAt: Date.now(),
    });

    return { id, isFirstApplicant: existing.length === 0 };
  },
});

// Public mutation for seekers to apply (via UI)
export const apply = authMutation({
  args: {
    jobSubmissionId: v.id('jobSubmissions'),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get seeker's profile
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', ctx.user.subject))
      .first();

    if (!profile) throw new Error('Profile not found - please complete your profile first');

    // Create application via internal mutation
    const result = await ctx.db.insert('applications', {
      jobSubmissionId: args.jobSubmissionId,
      seekerProfileId: profile._id,
      message: args.message,
      status: 'pending',
      appliedAt: Date.now(),
    });

    // Check if this is the first application
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_job', (q) => q.eq('jobSubmissionId', args.jobSubmissionId))
      .collect();

    const isFirstApplicant = applications.length === 1;

    // Trigger application workflow
    await ctx.scheduler.runAfter(0, internal.inngestNode.sendApplicationSubmittedEvent, {
      applicationId: result,
      jobSubmissionId: args.jobSubmissionId,
      seekerProfileId: profile._id,
      isFirstApplicant,
    });

    return { applicationId: result };
  },
});

// Public query for seeker to check if they've applied to a job
export const hasApplied = authQuery({
  args: { jobSubmissionId: v.id('jobSubmissions') },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', ctx.user.subject))
      .first();

    if (!profile) return false;

    const application = await ctx.db
      .query('applications')
      .withIndex('by_job', (q) => q.eq('jobSubmissionId', args.jobSubmissionId))
      .collect();

    return application.some((a) => a.seekerProfileId === profile._id);
  },
});

// Internal mutation to mark application as connected (employer sent DM)
export const markConnected = internalMutation({
  args: { applicationId: v.id('applications') },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error('Application not found');
    if (app.status === 'connected') return; // Idempotent

    await ctx.db.patch(args.applicationId, {
      status: 'connected',
      connectedAt: Date.now(),
    });
  },
});

// Internal mutation to mark application as passed
export const markPassed = internalMutation({
  args: { applicationId: v.id('applications') },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error('Application not found');
    if (app.status === 'passed') return; // Idempotent

    await ctx.db.patch(args.applicationId, {
      status: 'passed',
      passedAt: Date.now(),
    });
  },
});

// Public query: Get job with applications for employer (token-based auth)
export const getJobWithApplications = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenData = parseToken(args.token);
    if (!tokenData) return { error: 'invalid_token' as const };

    // Check expiry
    if (Date.now() > tokenData.exp) return { error: 'token_expired' as const };

    // Get sender
    const senderId = tokenData.senderId as Id<'senders'>;
    const sender = await ctx.db.get(senderId);
    if (!sender) return { error: 'invalid_token' as const };

    // Check employer exists and is approved
    const employer = await ctx.db
      .query('employers')
      .withIndex('by_sender', (q) => q.eq('senderId', senderId))
      .first();

    if (!employer) return { error: 'employer_not_found' as const };
    if (employer.status === 'pending_review') return { error: 'employer_pending' as const };
    if (employer.status === 'rejected') return { error: 'employer_rejected' as const };

    // Get job submission
    const jobId = tokenData.submissionId as Id<'jobSubmissions'>;
    const job = await ctx.db.get(jobId);
    if (!job) return { error: 'job_not_found' as const };
    if (job.senderId !== senderId) return { error: 'unauthorized' as const };

    // Get applications with seeker data
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_job', (q) => q.eq('jobSubmissionId', jobId))
      .collect();

    const enriched = await Promise.all(
      applications.map(async (app) => {
        const profile = await ctx.db.get(app.seekerProfileId);
        const resume = profile
          ? await ctx.db
              .query('resumes')
              .withIndex('by_workos_user_id', (q) =>
                q.eq('workosUserId', profile.workosUserId)
              )
              .first()
          : null;

        return {
          _id: app._id,
          message: app.message,
          status: app.status,
          appliedAt: app.appliedAt,
          connectedAt: app.connectedAt,
          passedAt: app.passedAt,
          seeker: profile
            ? {
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                headline: profile.headline,
                bio: profile.bio,
                resumeLink: profile.resumeLink,
                linkedinUrl: profile.linkedinUrl,
              }
            : null,
          resume: resume
            ? {
                summary: resume.summary,
                workExperience: resume.workExperience,
                education: resume.education,
                skills: resume.skills,
              }
            : null,
        };
      })
    );

    // Sort by appliedAt desc
    enriched.sort((a, b) => b.appliedAt - a.appliedAt);

    return {
      job: {
        _id: job._id,
        title: job.parsedJob?.title,
        company: job.parsedJob?.company.name,
        status: job.status,
        circlePostUrl: job.circlePostUrl,
      },
      applications: enriched,
      employer: {
        name: employer.name,
        company: employer.company,
      },
    };
  },
});

// Public mutation: Mark application as connected (employer wants to talk)
export const connectApplication = mutation({
  args: {
    token: v.string(),
    applicationId: v.id('applications'),
  },
  handler: async (ctx, args) => {
    const tokenData = parseToken(args.token);
    if (!tokenData) throw new Error('Invalid token');
    if (Date.now() > tokenData.exp) throw new Error('Token expired');

    // Verify employer is approved
    const senderId = tokenData.senderId as Id<'senders'>;
    const employer = await ctx.db
      .query('employers')
      .withIndex('by_sender', (q) => q.eq('senderId', senderId))
      .first();
    if (!employer || employer.status !== 'approved') {
      throw new Error('Employer not approved');
    }

    // Verify application belongs to this job
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error('Application not found');
    if (app.jobSubmissionId !== (tokenData.submissionId as Id<'jobSubmissions'>)) {
      throw new Error('Unauthorized');
    }

    // Mark as connected
    if (app.status !== 'connected') {
      await ctx.db.patch(args.applicationId, {
        status: 'connected',
        connectedAt: Date.now(),
      });
    }

    // Return seeker email for employer to contact
    const profile = await ctx.db.get(app.seekerProfileId);
    return {
      seekerEmail: profile?.email,
      seekerName: profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ''}`.trim()
        : null,
    };
  },
});

// Public mutation: Mark application as passed (employer not interested)
export const passApplication = mutation({
  args: {
    token: v.string(),
    applicationId: v.id('applications'),
  },
  handler: async (ctx, args) => {
    const tokenData = parseToken(args.token);
    if (!tokenData) throw new Error('Invalid token');
    if (Date.now() > tokenData.exp) throw new Error('Token expired');

    // Verify employer is approved
    const senderId = tokenData.senderId as Id<'senders'>;
    const employer = await ctx.db
      .query('employers')
      .withIndex('by_sender', (q) => q.eq('senderId', senderId))
      .first();
    if (!employer || employer.status !== 'approved') {
      throw new Error('Employer not approved');
    }

    // Verify application belongs to this job
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error('Application not found');
    if (app.jobSubmissionId !== (tokenData.submissionId as Id<'jobSubmissions'>)) {
      throw new Error('Unauthorized');
    }

    // Mark as passed
    if (app.status !== 'passed') {
      await ctx.db.patch(args.applicationId, {
        status: 'passed',
        passedAt: Date.now(),
      });
    }
  },
});
