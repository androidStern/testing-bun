import { z } from 'zod';

const schema = z.object({
  // Token/Auth
  TOKEN_SIGNING_SECRET: z.string().min(32),
  CONVEX_INTERNAL_SECRET: z.string().min(32),
  WORKOS_CLIENT_ID: z.string().startsWith('client_'),
  ADMIN_EMAILS: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().startsWith('+'),
  TWILIO_WEBHOOK_URL: z.string().url(),

  // Slack
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APPROVAL_CHANNEL: z.string().min(1),

  // AWS SES
  AWS_SES_SMTP_USER: z.string().min(1),
  AWS_SES_SMTP_PASS: z.string().min(1),
  AWS_REGION: z.string().min(1),
  SES_FROM_EMAIL: z.string().email(),

  // Circle
  CIRCLE_SPACE_ID: z.string().min(1),
  CIRCLE_API_TOKEN: z.string().min(1),

  // AI
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),

  // App
  APP_BASE_URL: z.string().url(),
  INNGEST_WEBHOOK_URL: z.string().url().optional(),
});

type Env = z.infer<typeof schema>;

let _parsed: Env | null = null;

export const env: Env = new Proxy({} as Env, {
  get(_, key: string) {
    if (!_parsed) _parsed = schema.parse(process.env);
    return _parsed[key as keyof Env];
  },
});
