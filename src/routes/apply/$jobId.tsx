import { Suspense, useEffect, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-react-start';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ProfileForm } from '@/components/ProfileForm';

const REDIRECT_DELAY_SECONDS = 5;

function SuccessScreen({ job }: { job: { title: string; company: string } }) {
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Go back to where they came from
          if (window.history.length > 1) {
            window.history.back();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.successIcon}>&#10003;</div>
        <h1 style={styles.successTitle}>You're all set!</h1>
        <p style={styles.successText}>
          The employer has been notified of your interest. If they'd like to
          connect, they'll reach out to you directly.
        </p>
        <div style={styles.jobPreview}>
          <h2 style={styles.jobTitle}>{job.title}</h2>
          <p style={styles.jobCompany}>{job.company}</p>
        </div>
        <p style={styles.redirectNote}>
          Returning in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/apply/$jobId')({
  loader: async ({ params, location }) => {
    const { user } = await getAuth();
    if (!user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: { returnPathname: path } });
      throw redirect({ href });
    }
    return { jobId: params.jobId as Id<'jobSubmissions'>, user };
  },
  component: ApplyPage,
});

function ApplyPage() {
  const { jobId, user } = Route.useLoaderData();
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileJustCreated, setProfileJustCreated] = useState(false);

  const job = useQuery(api.jobSubmissions.getForApply, { id: jobId });
  const hasApplied = useQuery(api.applications.hasApplied, {
    jobSubmissionId: jobId,
  });
  const profile = useQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id });
  const applyMutation = useMutation(api.applications.apply);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await applyMutation({
        jobSubmissionId: jobId,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    }
  };

  // Successfully submitted (check this FIRST - local state takes precedence)
  // This prevents the race condition where hasApplied becomes true before submitted is set
  if (submitted && job) {
    return <SuccessScreen job={job} />;
  }

  // Loading state
  if (job === undefined || hasApplied === undefined || profile === undefined) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  // Job not found or not approved
  if (job === null) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.errorTitle}>Job Not Found</h1>
          <p style={styles.errorText}>
            This job posting is no longer available or has been closed.
          </p>
        </div>
      </div>
    );
  }

  // No profile - show ProfileForm with job preview banner
  if (profile === null && !profileJustCreated) {
    return (
      <div style={styles.profilePageContainer}>
        <div style={styles.applyingForBanner}>
          <p style={styles.applyingForText}>Applying for:</p>
          <p style={styles.applyingForJob}>{job.title} at {job.company}</p>
        </div>

        <Suspense fallback={<div style={styles.loading}>Loading profile form...</div>}>
          <ProfileForm
            user={user}
            onSuccess={() => setProfileJustCreated(true)}
          />
        </Suspense>
      </div>
    );
  }

  // Already applied (from a previous session - hasApplied is true but submitted is false)
  if (hasApplied) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.successTitle}>Already Connected</h1>
          <p style={styles.successText}>
            You've already expressed interest in this position. The employer has
            been notified and will reach out if they'd like to connect.
          </p>
          <div style={styles.jobPreview}>
            <h2 style={styles.jobTitle}>{job.title}</h2>
            <p style={styles.jobCompany}>{job.company}</p>
          </div>
        </div>
      </div>
    );
  }

  // Application form
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Express Interest</h1>

        <div style={styles.jobPreview}>
          <h2 style={styles.jobTitle}>{job.title}</h2>
          <p style={styles.jobCompany}>{job.company}</p>
          {job.location && <p style={styles.jobLocation}>{job.location}</p>}
          {job.employmentType && (
            <span style={styles.badge}>
              {job.employmentType.replace('-', ' ')}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Add a note (optional)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share why you're interested in this opportunity..."
              style={styles.textarea}
              rows={4}
              maxLength={1000}
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <p style={styles.note}>
            Your profile will be shared with the employer.
          </p>

          <button type="submit" style={styles.submitButton}>
            I'm Interested
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    padding: '1rem',
  },
  card: {
    background: 'white',
    borderRadius: '1rem',
    padding: '2rem',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    padding: '2rem',
  },
  title: {
    margin: '0 0 1.5rem 0',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1f2937',
  },
  errorTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#dc2626',
  },
  errorText: {
    color: '#666',
    margin: 0,
  },
  successIcon: {
    width: '64px',
    height: '64px',
    background: '#22c55e',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: 'white',
    margin: '0 auto 1rem auto',
  },
  successTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1f2937',
    textAlign: 'center',
  },
  successText: {
    color: '#666',
    margin: '0 0 1.5rem 0',
    textAlign: 'center',
  },
  jobPreview: {
    background: '#f9fafb',
    borderRadius: '0.75rem',
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  jobTitle: {
    margin: '0 0 0.25rem 0',
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#1f2937',
  },
  jobCompany: {
    margin: '0 0 0.25rem 0',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  jobLocation: {
    margin: '0 0 0.5rem 0',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  badge: {
    display: 'inline-block',
    background: '#dbeafe',
    color: '#1d4ed8',
    padding: '0.25rem 0.75rem',
    borderRadius: '1rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
  },
  textarea: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  note: {
    fontSize: '0.75rem',
    color: '#6b7280',
    margin: 0,
  },
  profilePageContainer: {
    minHeight: '100vh',
    background: '#f5f5f5',
  },
  applyingForBanner: {
    background: '#3b82f6',
    color: 'white',
    padding: '0.75rem 1rem',
    textAlign: 'center',
  },
  applyingForText: {
    margin: 0,
    fontSize: '0.75rem',
    opacity: 0.9,
  },
  applyingForJob: {
    margin: '0.25rem 0 0 0',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  error: {
    color: '#dc2626',
    fontSize: '0.875rem',
    margin: 0,
    padding: '0.5rem',
    background: '#fef2f2',
    borderRadius: '0.5rem',
  },
  submitButton: {
    background: '#3b82f6',
    color: 'white',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  redirectNote: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    margin: '1.5rem 0 0 0',
    textAlign: 'center',
  },
};
