import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

export const Route = createFileRoute('/employer/candidates')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || '',
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const { token } = useSearch({ from: '/employer/candidates' });
  const data = useQuery(api.applications.getJobWithApplications, { token });
  const connectMutation = useMutation(api.applications.connectApplication);
  const passMutation = useMutation(api.applications.passApplication);

  // Loading
  if (data === undefined) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  // Error states
  if ('error' in data) {
    const errorMessages: Record<string, { title: string; text: string }> = {
      invalid_token: {
        title: 'Invalid Link',
        text: 'This link is no longer valid. Please use the link from your notification.',
      },
      token_expired: {
        title: 'Link Expired',
        text: 'This link has expired. Please contact support for a new link.',
      },
      employer_not_found: {
        title: 'Account Not Found',
        text: 'Please complete your account setup first.',
      },
      employer_pending: {
        title: 'Account Under Review',
        text: "We're still reviewing your account. You'll receive an SMS when approved.",
      },
      employer_rejected: {
        title: 'Account Not Approved',
        text: 'Your account was not approved. Please contact support.',
      },
      job_not_found: {
        title: 'Job Not Found',
        text: 'This job posting no longer exists.',
      },
      unauthorized: {
        title: 'Unauthorized',
        text: "You don't have access to this job posting.",
      },
    };
    const errorKey = data.error;
    const error = errorKey ? errorMessages[errorKey] : undefined;
    const displayError = error || {
      title: 'Error',
      text: 'Something went wrong.',
    };

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.errorTitle}>{displayError.title}</h1>
          <p style={styles.errorText}>{displayError.text}</p>
        </div>
      </div>
    );
  }

  const { job, applications, employer } = data;

  const handleConnect = async (applicationId: Id<'applications'>) => {
    if (!confirm('Connect with this candidate? Their contact info will be shared.')) return;
    try {
      const result = await connectMutation({ token, applicationId });
      if (result.seekerEmail) {
        alert(`Contact info:\nName: ${result.seekerName || 'Not provided'}\nEmail: ${result.seekerEmail}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  const handlePass = async (applicationId: Id<'applications'>) => {
    if (!confirm('Pass on this candidate?')) return;
    try {
      await passMutation({ token, applicationId });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pass');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Candidates for {job.title}</h1>
        <p style={styles.subtitle}>{employer.company}</p>
        <p style={styles.stats}>{applications.length} applicant(s)</p>
      </div>

      {applications.length === 0 ? (
        <div style={styles.empty}>
          <p>No applications yet.</p>
          <p style={styles.emptySubtext}>
            Candidates will appear here when they apply to your job posting.
          </p>
        </div>
      ) : (
        <div style={styles.applications}>
          {applications.map((app) => (
            <div key={app._id} style={styles.applicationCard}>
              <div style={styles.applicantHeader}>
                <div>
                  <h3 style={styles.applicantName}>
                    {app.seeker?.firstName} {app.seeker?.lastName}
                  </h3>
                  {app.seeker?.headline && (
                    <p style={styles.applicantHeadline}>{app.seeker.headline}</p>
                  )}
                </div>
                <span
                  style={{
                    ...styles.statusBadge,
                    background:
                      app.status === 'connected'
                        ? '#dcfce7'
                        : app.status === 'passed'
                          ? '#fee2e2'
                          : '#f3f4f6',
                    color:
                      app.status === 'connected'
                        ? '#166534'
                        : app.status === 'passed'
                          ? '#991b1b'
                          : '#374151',
                  }}
                >
                  {app.status === 'connected'
                    ? 'Connected'
                    : app.status === 'passed'
                      ? 'Passed'
                      : 'New'}
                </span>
              </div>

              <p style={styles.appliedDate}>
                Applied {new Date(app.appliedAt).toLocaleDateString()}
              </p>

              {app.message && (
                <div style={styles.messageBox}>
                  <p style={styles.messageLabel}>Message from applicant:</p>
                  <p style={styles.messageText}>{app.message}</p>
                </div>
              )}

              {app.seeker?.bio && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>About</h4>
                  <p style={styles.sectionText}>{app.seeker.bio}</p>
                </div>
              )}

              {app.resume?.summary && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Resume Summary</h4>
                  <p style={styles.sectionText}>{app.resume.summary}</p>
                </div>
              )}

              {app.resume?.workExperience && app.resume.workExperience.length > 0 && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Work Experience</h4>
                  {app.resume.workExperience.slice(0, 2).map((exp, i) => (
                    <div key={i} style={styles.experienceItem}>
                      <p style={styles.expTitle}>{exp.position}</p>
                      <p style={styles.expCompany}>{exp.company}</p>
                    </div>
                  ))}
                </div>
              )}

              {app.seeker?.resumeLink && (
                <p style={styles.resumeLink}>
                  <a
                    href={app.seeker.resumeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6' }}
                  >
                    View Full Resume
                  </a>
                </p>
              )}

              {app.seeker?.linkedinUrl && (
                <p style={styles.linkedinLink}>
                  <a
                    href={app.seeker.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0077b5' }}
                  >
                    LinkedIn Profile
                  </a>
                </p>
              )}

              {app.status === 'pending' && (
                <div style={styles.actions}>
                  <button
                    onClick={() => handleConnect(app._id)}
                    style={styles.connectButton}
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => handlePass(app._id)}
                    style={styles.passButton}
                  >
                    Pass
                  </button>
                </div>
              )}

              {app.status === 'connected' && app.seeker?.email && (
                <div style={styles.contactInfo}>
                  <p style={styles.contactLabel}>Contact info:</p>
                  <p>
                    <a href={`mailto:${app.seeker.email}`} style={{ color: '#3b82f6' }}>
                      {app.seeker.email}
                    </a>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
    padding: '2rem 1rem',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    padding: '4rem',
  },
  card: {
    background: 'white',
    borderRadius: '1rem',
    padding: '2rem',
    maxWidth: '500px',
    margin: '0 auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
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
  header: {
    maxWidth: '800px',
    margin: '0 auto 2rem auto',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.75rem',
    fontWeight: 600,
    color: '#1f2937',
  },
  subtitle: {
    margin: '0 0 0.5rem 0',
    color: '#6b7280',
  },
  stats: {
    margin: 0,
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
  empty: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: '#666',
  },
  emptySubtext: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    marginTop: '0.5rem',
  },
  applications: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  applicationCard: {
    background: 'white',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  applicantHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  applicantName: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#1f2937',
  },
  applicantHeadline: {
    margin: '0.25rem 0 0 0',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  statusBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '1rem',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  appliedDate: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    margin: '0 0 1rem 0',
  },
  messageBox: {
    background: '#f9fafb',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
  },
  messageLabel: {
    margin: '0 0 0.25rem 0',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#6b7280',
  },
  messageText: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#374151',
  },
  section: {
    marginBottom: '1rem',
  },
  sectionTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  sectionText: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#374151',
    lineHeight: 1.5,
  },
  experienceItem: {
    marginBottom: '0.5rem',
  },
  expTitle: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
  },
  expCompany: {
    margin: 0,
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  resumeLink: {
    margin: '0 0 0.5rem 0',
    fontSize: '0.875rem',
  },
  linkedinLink: {
    margin: '0 0 1rem 0',
    fontSize: '0.875rem',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb',
  },
  connectButton: {
    background: '#22c55e',
    color: 'white',
    padding: '0.5rem 1.25rem',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  passButton: {
    background: '#f3f4f6',
    color: '#374151',
    padding: '0.5rem 1.25rem',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  contactInfo: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb',
  },
  contactLabel: {
    margin: '0 0 0.25rem 0',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#6b7280',
  },
};
