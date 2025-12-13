import type { Doc, Id } from '../_generated/dataModel';

interface PostToCircleOptions {
  job: NonNullable<Doc<'jobSubmissions'>['parsedJob']>;
  jobSubmissionId: Id<'jobSubmissions'>;
  spaceId: string;
  apiToken: string;
  appBaseUrl: string; // e.g., "https://recoveryjobs.com"
}

export async function postToCircle({
  job,
  jobSubmissionId,
  spaceId,
  apiToken,
  appBaseUrl,
}: PostToCircleOptions): Promise<{ postId: string; postUrl: string }> {
  const locationStr = job.location
    ? [job.location.city, job.location.state].filter(Boolean).join(', ')
    : '';

  const companyName = job.company?.name || 'Recovery-Friendly Employer';
  const name = `${job.title} at ${companyName}${locationStr ? ` — ${locationStr}` : ''}`;

  // Build HTML content for the post with apply URL
  const applyUrl = `${appBaseUrl}/apply/${jobSubmissionId}`;
  const html = buildJobPostHtml(job, applyUrl);

  const res = await fetch('https://app.circle.so/api/admin/v2/posts', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiToken}`, // Admin v2 uses "Token", not "Bearer"
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      internal_custom_html: html,
      space_id: Number(spaceId),
      is_comments_enabled: true,
      is_liking_enabled: true,
      topics: locationStr ? [job.location?.city] : [],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Circle error ${res.status}: ${errorText}`);
  }

  const json = (await res.json()) as { post?: { url?: string; id?: string } };

  if (!json.post?.id) {
    throw new Error('Circle post ID not found in response');
  }

  return {
    postId: json.post.id,
    postUrl: json.post.url || '',
  };
}

function buildJobPostHtml(
  job: NonNullable<Doc<'jobSubmissions'>['parsedJob']>,
  applyUrl: string
): string {
  const companyName = job.company?.name || 'Recovery-Friendly Employer';

  const salaryStr =
    job.salary?.min !== undefined && job.salary?.max !== undefined
      ? `$${job.salary.min} - $${job.salary.max} / ${job.salary.unit}`
      : job.salary?.amount
        ? `$${job.salary.amount} / ${job.salary.unit}`
        : null;

  const locationStr = job.location
    ? [job.location.city, job.location.state].filter(Boolean).join(', ')
    : null;

  const employmentType = job.employmentType
    ? job.employmentType
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Full Time';

  return `
<div style="font-family: system-ui, -apple-system, sans-serif;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 100%); border-radius: 16px; padding: 24px; color: white;">

    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold;">
        ${companyName.charAt(0).toUpperCase()}
      </div>
      <div>
        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">${job.title}</h2>
        <p style="margin: 4px 0 0 0; opacity: 0.8; font-size: 14px;">${companyName}</p>
      </div>
      <span style="margin-left: auto; background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(74, 222, 128, 0.3); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #86efac;">
        ${employmentType}
      </span>
    </div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        ${(job.workArrangement || locationStr) ? `<div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #60a5fa;">📍</span>
          <span style="font-size: 14px; opacity: 0.9;">${job.workArrangement === 'remote' ? 'Remote' : (locationStr || job.workArrangement?.replace('-', ' ').replace(/^\w/, c => c.toUpperCase()) || '')}</span>
        </div>` : ''}
        ${salaryStr ? `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: #60a5fa;">💰</span><span style="font-size: 14px; opacity: 0.9;">${salaryStr}</span></div>` : ''}
      </div>
    </div>

    ${job.description ? `<div style="margin-bottom: 20px;"><h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">About the Role</h3><p style="font-size: 14px; line-height: 1.6; opacity: 0.9; margin: 0;">${job.description}</p></div>` : ''}

    ${
      job.skills?.length
        ? `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Required Skills</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${job.skills.map((skill) => `<span style="background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(96, 165, 250, 0.3); padding: 4px 10px; border-radius: 8px; font-size: 12px; color: #93c5fd;">${skill}</span>`).join('')}
      </div>
    </div>
    `
        : ''
    }

    ${
      job.requirements?.length
        ? `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Requirements</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${job.requirements.map((req) => `<span style="background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(96, 165, 250, 0.3); padding: 4px 10px; border-radius: 8px; font-size: 12px; color: #93c5fd;">${req}</span>`).join('')}
      </div>
    </div>
    `
        : ''
    }

    <div style="display: flex; gap: 12px; margin-top: 20px;">
      <a href="${applyUrl}" style="flex: 1; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; text-align: center; font-weight: 500; font-size: 14px;">
        I'm Interested
      </a>
    </div>
  </div>
</div>
  `.trim();
}
