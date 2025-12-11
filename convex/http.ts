import { httpRouter } from 'convex/server';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import { createConvexServe, inngest, processJobSubmission } from './inngest';

// Inngest serve handler - passes ActionCtx to middleware
const inngestHandler = createConvexServe({
  client: inngest,
  functions: [processJobSubmission],
});

const http = httpRouter();

// Inngest API endpoint - handles GET (introspection), POST and PUT (function execution)
http.route({
  path: '/api/inngest',
  method: 'GET',
  handler: httpAction(async (ctx, request) => inngestHandler(request, ctx)),
});

http.route({
  path: '/api/inngest',
  method: 'POST',
  handler: httpAction(async (ctx, request) => inngestHandler(request, ctx)),
});

http.route({
  path: '/api/inngest',
  method: 'PUT',
  handler: httpAction(async (ctx, request) => inngestHandler(request, ctx)),
});

http.route({
  path: '/webhooks/twilio-sms',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return new Response('Invalid content type', { status: 400 });
    }

    const formData = await request.formData();
    const phone = formData.get('From') as string | null;
    const body = formData.get('Body') as string | null;
    const twilioMessageSid = formData.get('MessageSid') as string | null;

    if (!phone || !body || !twilioMessageSid) {
      console.error('Missing required Twilio fields:', { phone, body, twilioMessageSid });
      return new Response('Missing required fields', { status: 400 });
    }

    // Look up sender
    const sender = await ctx.runQuery(api.senders.getByPhone, { phone });

    let messageStatus: string;
    let senderId: Id<'senders'> | undefined;

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

    // Save the message
    await ctx.runMutation(api.inboundMessages.create, {
      phone,
      body,
      twilioMessageSid,
      senderId,
      status: messageStatus,
    });

    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }),
});

export default http;
