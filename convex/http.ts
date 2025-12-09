import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

http.route({
  path: '/webhooks/twilio-sms',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return new Response('Invalid content type', { status: 400 });
    }

    const formData = await request.formData();
    const from = formData.get('From') as string | null;
    const body = formData.get('Body') as string | null;
    const messageSid = formData.get('MessageSid') as string | null;

    if (!from || !body || !messageSid) {
      console.error('Missing required Twilio fields:', { from, body, messageSid });
      return new Response('Missing required fields', { status: 400 });
    }

    await ctx.runMutation(internal.inboundJobs.createFromSms, {
      phone: from,
      rawText: body,
      twilioMessageSid: messageSid,
    });

    // Return empty TwiML response (no SMS reply)
    return new Response('<Response></Response>', {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }),
});

export default http;
