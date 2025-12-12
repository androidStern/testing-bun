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
 */
export async function sendSms({
  to,
  body,
  accountSid = process.env.TWILIO_ACCOUNT_SID,
  authToken = process.env.TWILIO_AUTH_TOKEN,
  fromNumber = process.env.TWILIO_PHONE_NUMBER,
}: SendSmsOptions): Promise<SendSmsResult> {
  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials not configured, skipping SMS');
    return {
      success: false,
      error: 'Twilio credentials not configured',
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as { sid?: string; message?: string };

    if (!response.ok) {
      console.error('Twilio API error:', data);
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    console.log(`SMS sent to ${to}, SID: ${data.sid}`);
    return {
      success: true,
      messageSid: data.sid,
    };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
