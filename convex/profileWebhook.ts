import { v } from 'convex/values';
import { internalAction } from './_generated/server';

// Map our thingsICanOffer values to the format Inngest expects
const PLATFORM_GOALS_MAP: Record<string, string> = {
  'To find a job': '🔍 To find a job',
  'To lend a hand': '🤝 To give back to the community',
  'To post a job': '💼 To post a job',
  Entrepreneurship: '🚀 Entrepreneurship',
};

export const sendProfileWebhook = internalAction({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    thingsICanOffer: v.array(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    resumeLink: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    instagramUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const webhookUrl = process.env.INNGEST_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error('INNGEST_WEBHOOK_URL environment variable is not configured');
    }

    // Map platform goals to expected format
    const platformGoals = args.thingsICanOffer
      .map((goal) => PLATFORM_GOALS_MAP[goal] || goal)
      .filter(Boolean);

    // Build the payload in the format Inngest transform expects
    const payload = {
      data: {
        fields: {
          first_name: args.firstName || undefined,
          last_name: args.lastName || undefined,
          most_recent_title: args.headline || undefined,
          platform_goals: platformGoals,
          // TODO: The job-ingress webhook schema doesn't have a `bio` field.
          // It only accepts `entrepreneurship_vision` which maps to Circle's bio.
          // We should update job-ingress to accept `bio` directly and fall back
          // to entrepreneurship_vision for backwards compatibility.
          entrepreneurship_vision: args.bio || undefined,
        },
        user: {
          email: args.email,
          email_verified: true,
          user_id: args.workosUserId,
        },
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inngest webhook failed: ${response.status} ${text}`);
    }

    console.log('Inngest webhook sent successfully');
    return { success: true };
  },
});
