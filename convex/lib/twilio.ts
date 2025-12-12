// Twilio SMS sending via REST API
// Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

interface SendSmsOptions {
  to: string;
  body: string;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Send an SMS via Twilio REST API
 * Uses env vars if credentials not provided
 * Throws if credentials are missing - do not silently fail
 */
export async function sendSms({
  to,
  body,
  accountSid = process.env.TWILIO_ACCOUNT_SID,
  authToken = process.env.TWILIO_AUTH_TOKEN,
  fromNumber = process.env.TWILIO_PHONE_NUMBER,
}: SendSmsOptions): Promise<SendSmsResult> {
  if (!accountSid) {
    throw new Error('TWILIO_ACCOUNT_SID environment variable is not configured');
  }
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN environment variable is not configured');
  }
  if (!fromNumber) {
    throw new Error('TWILIO_PHONE_NUMBER environment variable is not configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: body,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
    body: formData.toString(),
  });

  const data = (await response.json()) as { sid?: string; message?: string; code?: number };

  if (!response.ok) {
    throw new Error(`Twilio API error: ${data.message || `HTTP ${response.status}`} (code: ${data.code})`);
  }

  console.log(`SMS sent to ${to}, SID: ${data.sid}`);
  return {
    success: true,
    messageSid: data.sid,
  };
}
