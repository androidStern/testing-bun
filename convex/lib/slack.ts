import type { Doc } from '../_generated/dataModel';

type ActionBlock = {
  type: 'actions';
  elements: Array<{
    type: 'button';
    action_id: string;
    text: { type: 'plain_text'; text: string };
    style?: 'primary' | 'danger';
    value: string;
  }>;
};

type SectionBlock = {
  type: 'section';
  text?: { type: 'mrkdwn'; text: string };
  fields?: Array<{ type: 'mrkdwn'; text: string }>;
};

export type SlackBlock = ActionBlock | SectionBlock;

interface PostSlackApprovalOptions {
  token: string;
  channel: string;
  submissionId: string;
  job: NonNullable<Doc<'jobSubmissions'>['parsedJob']>;
  appBaseUrl: string;
}

export async function postSlackApproval({
  token,
  channel,
  submissionId,
  job,
  appBaseUrl,
}: PostSlackApprovalOptions): Promise<{ blocks: Array<SlackBlock>; ts: string }> {
  const blocks = buildJobApprovalBlocks(job, submissionId, appBaseUrl);

  const body = {
    channel,
    text: `Approve job: ${job.title}`,
    blocks,
  };

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `Slack chat.postMessage failed: ${res.status} ${await res.text()}`
    );
  }

  const responseBody = (await res.json()) as {
    ok: boolean;
    ts?: string;
    error?: string;
  };

  if (!responseBody.ok) {
    throw new Error(`Slack API error: ${responseBody.error}`);
  }

  return { blocks, ts: responseBody.ts || '' };
}

// Helper to build job fields (shared by postSlackApproval and updateSlackJobMessage)
function buildJobFields(
  job: NonNullable<Doc<'jobSubmissions'>['parsedJob']>,
  submissionId: string,
  appBaseUrl: string
): Array<{ type: 'mrkdwn'; text: string }> {
  const allFields: Array<{ type: 'mrkdwn'; text: string }> = [];

  allFields.push({ type: 'mrkdwn', text: `*Company:*\n${job.company.name}` });

  if (job.description) {
    // Truncate description if too long for Slack field (max ~2000 chars)
    const desc = job.description.length > 500
      ? job.description.slice(0, 497) + '...'
      : job.description;
    allFields.push({ type: 'mrkdwn', text: `*Description:*\n${desc}` });
  }

  if (job.workArrangement) {
    allFields.push({
      type: 'mrkdwn',
      text: `*Work Arrangement:*\n${job.workArrangement}`,
    });
  }

  if (job.location) {
    const location = [job.location.city, job.location.state]
      .filter(Boolean)
      .join(', ');
    if (location) {
      allFields.push({ type: 'mrkdwn', text: `*Location:*\n${location}` });
    }
  }

  if (job.employmentType) {
    allFields.push({
      type: 'mrkdwn',
      text: `*Employment Type:*\n${job.employmentType}`,
    });
  }

  if (job.salary) {
    const salaryStr =
      job.salary.min !== undefined && job.salary.max !== undefined
        ? `$${job.salary.min} - $${job.salary.max} / ${job.salary.unit}`
        : job.salary.amount
          ? `$${job.salary.amount} / ${job.salary.unit}`
          : '';
    if (salaryStr) {
      allFields.push({ type: 'mrkdwn', text: `*Salary:*\n${salaryStr}` });
    }
  }

  if (job.skills?.length) {
    allFields.push({
      type: 'mrkdwn',
      text: `*Skills:*\n${job.skills.join(', ')}`,
    });
  }

  const contactParts = [];
  if (job.contact.name) contactParts.push(job.contact.name);
  const contactValue = job.contact.email ?? job.contact.phone;
  if (contactValue) contactParts.push(`${job.contact.method}: ${contactValue}`);
  if (contactParts.length) {
    allFields.push({
      type: 'mrkdwn',
      text: `*Contact:*\n${contactParts.join(' - ')}`,
    });
  }

  const adminUrl = `${appBaseUrl}/admin?tab=pending-jobs&job=${submissionId}`;
  allFields.push({
    type: 'mrkdwn',
    text: `*Admin:*\n<${adminUrl}|View/Edit in Admin>`,
  });

  return allFields;
}

// Build complete job approval blocks with approve/deny buttons
function buildJobApprovalBlocks(
  job: NonNullable<Doc<'jobSubmissions'>['parsedJob']>,
  submissionId: string,
  appBaseUrl: string
): Array<SlackBlock> {
  const allFields = buildJobFields(job, submissionId, appBaseUrl);

  // Split fields into chunks of 10 (Slack's limit)
  const fieldChunks: Array<typeof allFields> = [];
  for (let i = 0; i < allFields.length; i += 10) {
    fieldChunks.push(allFields.slice(i, i + 10));
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${job.title}* at *${job.company.name}*`,
      },
    },
    ...fieldChunks.map(
      (fields) =>
        ({
          type: 'section',
          fields,
        }) as SectionBlock
    ),
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: 'approve',
          style: 'primary',
          text: { type: 'plain_text', text: 'Approve' },
          value: submissionId,
        },
        {
          type: 'button',
          action_id: 'deny',
          style: 'danger',
          text: { type: 'plain_text', text: 'Deny' },
          value: submissionId,
        },
      ],
    },
  ];
}

interface UpdateSlackJobMessageOptions {
  token: string;
  channel: string;
  ts: string;
  submissionId: string;
  job: NonNullable<Doc<'jobSubmissions'>['parsedJob']>;
  appBaseUrl: string;
}

/**
 * Update an existing Slack job approval message with new job data.
 * Used when admin edits job fields before approval.
 */
export async function updateSlackJobMessage({
  token,
  channel,
  ts,
  submissionId,
  job,
  appBaseUrl,
}: UpdateSlackJobMessageOptions): Promise<void> {
  const blocks = buildJobApprovalBlocks(job, submissionId, appBaseUrl);

  const res = await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      ts,
      text: `Approve job: ${job.title} (edited)`,
      blocks,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Slack chat.update failed: ${res.status} ${await res.text()}`
    );
  }

  const responseBody = (await res.json()) as {
    ok: boolean;
    error?: string;
  };

  if (!responseBody.ok) {
    throw new Error(`Slack API error: ${responseBody.error}`);
  }
}

interface PostEmployerVettingOptions {
  token: string;
  channel: string;
  employer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    role?: string;
    website?: string;
  };
  appBaseUrl: string;
}

/**
 * Post Slack notification for employer account vetting (Checkpoint 3)
 */
export async function postEmployerVetting({
  token,
  channel,
  employer,
  appBaseUrl,
}: PostEmployerVettingOptions): Promise<{ ts: string }> {
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [
    { type: 'mrkdwn', text: `*Name:*\n${employer.name}` },
    { type: 'mrkdwn', text: `*Email:*\n${employer.email}` },
    { type: 'mrkdwn', text: `*Phone:*\n${employer.phone}` },
    { type: 'mrkdwn', text: `*Company:*\n${employer.company}` },
  ];

  if (employer.role) {
    fields.push({ type: 'mrkdwn', text: `*Role:*\n${employer.role}` });
  }
  if (employer.website) {
    fields.push({ type: 'mrkdwn', text: `*Website:*\n${employer.website}` });
  }

  const adminUrl = `${appBaseUrl}/admin?tab=pending-employers`;

  const blocks: Array<SlackBlock> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:briefcase: *New Employer Account Pending Review*\n${employer.name} from ${employer.company} has requested access to view candidates.`,
      },
    },
    {
      type: 'section',
      fields,
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${adminUrl}|View in Admin Dashboard>`,
      },
    },
  ];

  const body = {
    channel,
    text: `Employer vetting: ${employer.name} from ${employer.company}`,
    blocks,
  };

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `Slack chat.postMessage failed: ${res.status} ${await res.text()}`
    );
  }

  const responseBody = (await res.json()) as {
    ok: boolean;
    ts?: string;
    error?: string;
  };

  if (!responseBody.ok) {
    throw new Error(`Slack API error: ${responseBody.error}`);
  }

  return { ts: responseBody.ts || '' };
}

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackSignature({
  body,
  requestSignature,
  requestTimestamp,
  signingSecret,
}: {
  body: string;
  requestSignature: string;
  requestTimestamp: number | string;
  signingSecret: string;
}): Promise<boolean> {
  const timestamp = Number(requestTimestamp);

  // Reject if timestamp is older than 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (timestamp < fiveMinutesAgo) {
    return false;
  }

  // Create signature base string
  const sigBasestring = `v0:${timestamp}:${body}`;

  // Create HMAC-SHA256 hash
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(sigBasestring)
  );

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  const computedSignature = `v0=${hashHex}`;

  // Constant-time comparison
  return computedSignature === requestSignature;
}
