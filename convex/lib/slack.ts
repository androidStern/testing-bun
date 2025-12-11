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
}

export async function postSlackApproval({
  token,
  channel,
  submissionId,
  job,
}: PostSlackApprovalOptions): Promise<{ blocks: SlackBlock[]; ts: string }> {
  const allFields: Array<{ type: 'mrkdwn'; text: string }> = [];

  // Build fields from job data
  allFields.push({ type: 'mrkdwn', text: `*Company:*\n${job.company.name}` });
  allFields.push({
    type: 'mrkdwn',
    text: `*Work Arrangement:*\n${job.workArrangement}`,
  });

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

  if (job.contact) {
    allFields.push({
      type: 'mrkdwn',
      text: `*Contact:*\n${job.contact.name} (${job.contact.method}: ${job.contact.email || job.contact.phone})`,
    });
  }

  allFields.push({
    type: 'mrkdwn',
    text: `*Submission ID:*\n${submissionId}`,
  });

  // Split fields into chunks of 10 (Slack's limit)
  const fieldChunks: Array<typeof allFields> = [];
  for (let i = 0; i < allFields.length; i += 10) {
    fieldChunks.push(allFields.slice(i, i + 10));
  }

  // Build blocks
  const blocks: SlackBlock[] = [
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

interface UpdateSlackApprovalOptions {
  responseUrl: string;
  decision: 'approved' | 'denied';
  userName: string;
  originalBlocks: SlackBlock[];
}

export async function updateSlackApproval({
  responseUrl,
  decision,
  userName,
  originalBlocks,
}: UpdateSlackApprovalOptions): Promise<void> {
  // Remove actions block and add status
  const updatedBlocks = originalBlocks.filter(
    (block) => block.type !== 'actions'
  );
  updatedBlocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        decision === 'approved'
          ? `*Approved* by @${userName}`
          : `*Denied* by @${userName}`,
    },
  });

  const res = await fetch(responseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      replace_original: true,
      blocks: updatedBlocks,
    }),
  });

  if (!res.ok) {
    console.error('Slack update failed:', await res.text());
  }
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
