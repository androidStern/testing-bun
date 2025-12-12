"use node";

import nodemailer from "nodemailer";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { createInngestHandler } from "./inngest/handler";

export const handle = internalAction({
  args: {
    method: v.string(),
    url: v.string(),
    headers: v.any(), // Record<string, string>
    body: v.string(),
  },
  returns: v.object({
    status: v.number(),
    headers: v.any(), // Record<string, string>
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Reconstruct Request object
    const request = new Request(args.url, {
      method: args.method,
      headers: new Headers(args.headers as Record<string, string>),
      body: args.method !== "GET" && args.method !== "HEAD" ? args.body : undefined,
    });

    // 2. Create Inngest handler that uses THIS action's ctx
    const handler = createInngestHandler(ctx);

    // 3. Run Inngest SDK (node:async_hooks works here!)
    const response = await handler(request);

    // 4. Serialize Response
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    return {
      status: response.status,
      headers: responseHeaders,
      body: await response.text(),
    };
  },
});

// Action to send job/submitted event to Inngest (triggers the workflow)
export const sendJobSubmittedEvent = internalAction({
  args: {
    submissionId: v.string(),
    source: v.union(v.literal("sms"), v.literal("form")),
  },
  handler: async (_ctx, args) => {
    const { inngest } = await import("./inngest");
    await inngest.send({
      name: "job/submitted",
      data: {
        submissionId: args.submissionId,
        source: args.source,
      },
    });
  },
});

// Action to send approval events to Inngest (resumes the waiting workflow)
export const sendApprovalEvent = internalAction({
  args: {
    approvalId: v.string(),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    approvedBy: v.optional(v.string()),
    denyReason: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { inngest } = await import("./inngest");
    await inngest.send({
      name: "slack/approval.clicked",
      data: {
        approvalId: args.approvalId,
        decision: args.decision,
        // No slack field = workflow knows it came from in-app
        ...(args.approvedBy && { approvedBy: args.approvedBy }),
        ...(args.denyReason && { denyReason: args.denyReason }),
      },
    });
  },
});

// Action to send application/submitted event (triggers application workflow)
export const sendApplicationSubmittedEvent = internalAction({
  args: {
    applicationId: v.string(),
    jobSubmissionId: v.string(),
    seekerProfileId: v.string(),
    isFirstApplicant: v.boolean(),
  },
  handler: async (_ctx, args) => {
    const { inngest } = await import("./inngest");
    await inngest.send({
      name: "application/submitted",
      data: {
        applicationId: args.applicationId,
        jobSubmissionId: args.jobSubmissionId,
        seekerProfileId: args.seekerProfileId,
        isFirstApplicant: args.isFirstApplicant,
      },
    });
  },
});

// Action to send employer/approved event (resumes waiting job workflow)
export const sendEmployerApprovedEvent = internalAction({
  args: {
    employerId: v.string(),
    approvedBy: v.string(),
  },
  handler: async (_ctx, args) => {
    const { inngest } = await import("./inngest");
    await inngest.send({
      name: "employer/approved",
      data: {
        employerId: args.employerId,
        approvedBy: args.approvedBy,
      },
    });
  },
});

// Action to send email via AWS SES SMTP
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    const smtpUser = process.env.AWS_SES_SMTP_USER;
    const smtpPass = process.env.AWS_SES_SMTP_PASS;
    const region = process.env.AWS_REGION;
    const fromEmail = process.env.SES_FROM_EMAIL;

    if (!smtpUser) {
      throw new Error("AWS_SES_SMTP_USER environment variable is not configured");
    }
    if (!smtpPass) {
      throw new Error("AWS_SES_SMTP_PASS environment variable is not configured");
    }
    if (!region) {
      throw new Error("AWS_REGION environment variable is not configured");
    }
    if (!fromEmail) {
      throw new Error("SES_FROM_EMAIL environment variable is not configured");
    }

    const smtpHost = `email-smtp.${region}.amazonaws.com`;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `Recovery Jobs <${fromEmail}>`,
      to: args.to,
      subject: args.subject,
      text: args.body,
    });

    console.log(`Email sent to ${args.to}, messageId: ${info.messageId}`);

    return { messageId: info.messageId };
  },
});

// Action to post employer vetting notification to Slack (Checkpoint 3)
export const postEmployerVettingToSlack = internalAction({
  args: {
    employerId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    company: v.string(),
    role: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { postEmployerVetting } = await import("./lib/slack");

    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_APPROVAL_CHANNEL;
    const appBaseUrl = process.env.APP_BASE_URL || "https://recovery-jobs.com";

    if (!token || !channel) {
      console.warn("Slack credentials not configured, skipping employer vetting notification");
      return;
    }

    await postEmployerVetting({
      token,
      channel,
      employer: {
        id: args.employerId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        company: args.company,
        role: args.role,
        website: args.website,
      },
      appBaseUrl,
    });
  },
});
