import { httpRouter } from 'convex/server';

import { api, internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { env } from './lib/env';
import { verifyTwilioSignature } from './lib/twilio';

import type { Id } from './_generated/dataModel';

// Validate all env vars on first HTTP request
void env.TOKEN_SIGNING_SECRET;

const http = httpRouter();

// Helper to convert Headers to plain object
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Helper to bridge HTTP action to Node.js action for Inngest
async function bridgeToNodeAction(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request
) {
  const result = await ctx.runAction(internal.inngestNode.handle, {
    method: request.method,
    url: request.url,
    headers: headersToObject(request.headers),
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : '',
  });
  return new Response(result.body, {
    status: result.status,
    headers: result.headers as HeadersInit,
  });
}

// Inngest API endpoint - bridges to Node.js action for node:async_hooks support
http.route({
  path: '/api/inngest',
  method: 'GET',
  handler: httpAction(async (ctx, request) => bridgeToNodeAction(ctx, request)),
});

http.route({
  path: '/api/inngest',
  method: 'POST',
  handler: httpAction(async (ctx, request) => bridgeToNodeAction(ctx, request)),
});

http.route({
  path: '/api/inngest',
  method: 'PUT',
  handler: httpAction(async (ctx, request) => bridgeToNodeAction(ctx, request)),
});

http.route({
  path: '/webhooks/twilio-sms',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return new Response('Invalid content type', { status: 400 });
    }

    // Read body as text to verify signature, then parse as form data
    const bodyText = await request.text();
    const formParams = new URLSearchParams(bodyText);

    // Convert to plain object for signature verification
    const params: Record<string, string> = {};
    formParams.forEach((value, key) => {
      params[key] = value;
    });

    // Verify Twilio signature
    const signature = request.headers.get('X-Twilio-Signature') || '';
    const isValid = await verifyTwilioSignature({
      webhookUrl: env.TWILIO_WEBHOOK_URL,
      params,
      signature,
    });

    if (!isValid) {
      console.error('Invalid Twilio signature');
      return new Response('Invalid signature', { status: 403 });
    }

    const phone = params.From || null;
    const body = params.Body || null;
    const twilioMessageSid = params.MessageSid || null;

    if (!phone || !body || !twilioMessageSid) {
      console.error('Missing required Twilio fields:', { phone, body, twilioMessageSid });
      return new Response('Missing required fields', { status: 400 });
    }

    // Check for STOP/CLOSE command (case-insensitive, allow whitespace)
    const normalizedBody = body.trim().toUpperCase();
    if (normalizedBody === 'STOP' || normalizedBody === 'CLOSE') {
      // Look up sender
      const sender = await ctx.runQuery(api.senders.getByPhone, { phone });
      if (sender) {
        // Find their most recent open job
        const openJob = await ctx.runQuery(internal.jobSubmissions.getOpenBySender, {
          senderId: sender._id,
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- openJob can be null at runtime
        if (openJob) {
          await ctx.runMutation(internal.jobSubmissions.close, {
            id: openJob._id,
            reason: 'employer_request',
          });
          console.log(`Job ${openJob._id} closed by sender ${sender._id} via SMS STOP command`);
        }
      }
      // Return empty TwiML - no need to log the STOP message as a job submission
      return new Response('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Look up sender
    const sender = await ctx.runQuery(api.senders.getByPhone, { phone });

    let messageStatus: string;
    let senderId: Id<'senders'>;

    if (!sender) {
      // New sender - create as pending
      senderId = await ctx.runMutation(api.senders.create, {
        phone,
        status: 'pending',
      });
      messageStatus = 'pending_review';
    } else {
      senderId = sender._id;
      if (sender.status === 'approved') {
        messageStatus = 'approved';
      } else if (sender.status === 'blocked') {
        messageStatus = 'rejected';
      } else {
        messageStatus = 'pending_review';
      }
    }

    // Save the inbound message (for tracking all SMS)
    await ctx.runMutation(api.inboundMessages.create, {
      phone,
      body,
      twilioMessageSid,
      senderId,
      status: messageStatus,
    });

    // Create a job submission and trigger the Inngest workflow
    // Only process if sender is not blocked
    if (messageStatus !== 'rejected') {
      const submissionId = await ctx.runMutation(internal.jobSubmissions.create, {
        source: 'sms',
        senderId,
        rawContent: body,
      });

      // Trigger Inngest workflow (via Node.js action since inngest.send needs node:async_hooks)
      await ctx.scheduler.runAfter(0, internal.inngestNode.sendJobSubmittedEvent, {
        submissionId,
        source: 'sms',
      });
    }

    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }),
});

export default http;
