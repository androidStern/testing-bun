import { timingSafeEqual } from './crypto';
import { env } from './env';

// Twilio SMS sending and webhook verification via REST API

/**
 * Verify Twilio webhook signature (X-Twilio-Signature header)
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function verifyTwilioSignature({
  webhookUrl,
  params,
  signature,
}: {
  webhookUrl: string;
  params: Record<string, string>;
  signature: string;
}): Promise<boolean> {
  if (!signature) {
    return false;
  }

  // Build the data string: URL + sorted params (key + value)
  const sortedKeys = Object.keys(params).sort();
  let dataString = webhookUrl;
  for (const key of sortedKeys) {
    dataString += key + params[key];
  }

  // Compute HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.TWILIO_AUTH_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(dataString));
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  return timingSafeEqual(computedSignature, signature);
}

interface SendSmsResult {
  success: boolean;
  messageSid?: string;
}

/**
 * Send an SMS via Twilio REST API
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const formData = new URLSearchParams({
    To: to,
    From: env.TWILIO_PHONE_NUMBER,
    Body: body,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
    },
    body: formData.toString(),
  });

  const data = (await response.json()) as { sid?: string; message?: string; code?: number };

  if (!response.ok) {
    // Log full details server-side for debugging
    console.error('Twilio API error', {
      status: response.status,
      message: data.message,
      code: data.code,
    });
    // Throw generic error to caller (don't expose Twilio internals)
    throw new Error('Failed to send SMS');
  }

  // Redact phone number in logs (PII protection)
  const redactedPhone = `***${to.slice(-4)}`;
  console.log(`SMS sent to ${redactedPhone}, SID: ${data.sid}`);
  return {
    success: true,
    messageSid: data.sid,
  };
}
