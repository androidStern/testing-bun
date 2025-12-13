import { useEffect, useState } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

export const Route = createFileRoute('/employer/setup')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || '',
  }),
  component: EmployerSetupPage,
});

function EmployerSetupPage() {
  const { token } = useSearch({ from: '/employer/setup' });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupData = useQuery(api.employers.getSenderForSetup, { token });
  const createEmployerMutation = useMutation(api.employers.createFromSignup);

  // Pre-fill form when data loads
  useEffect(() => {
    if (setupData?.prefill) {
      setFormData((prev) => ({
        ...prev,
        name: setupData.prefill.name || prev.name,
        email: setupData.prefill.email || prev.email,
        phone: setupData.prefill.phone || prev.phone,
        company: setupData.prefill.company || prev.company,
      }));
    }
  }, [setupData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Phone is required');
      return;
    }
    if (!formData.company.trim()) {
      setError('Company name is required');
      return;
    }

    setSubmitting(true);
    try {
      await createEmployerMutation({
        token,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        company: formData.company.trim(),
        role: formData.role.trim() || undefined,
        website: formData.website.trim() || undefined,
      });
      // Don't set local state - let the reactive query update the UI
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create account'
      );
      setSubmitting(false);
    }
  };

  // Loading state
  if (setupData === undefined) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (setupData === null) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.errorTitle}>Invalid or Expired Link</h1>
          <p style={styles.errorText}>
            This setup link is no longer valid. If you received a notification
            about an applicant, please contact support for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Already set up - show status (this also handles the "just submitted" case via reactive query)
  if (setupData.alreadySetup) {
    const statusMessages: Record<string, { title: string; text: string; subtext?: string }> = {
      pending_review: {
        title: 'Account Under Review',
        text: "We're reviewing your information. You'll receive an email when your account is approved.",
        subtext: 'You have candidates waiting! Once approved, you can view and connect with them.',
      },
      approved: {
        title: 'Account Ready',
        text: 'Your account has been approved. You can now view candidates who have applied to your job.',
      },
      rejected: {
        title: 'Account Not Approved',
        text: 'Your account was not approved. Please contact support if you believe this is an error.',
      },
    };
    const status = statusMessages[setupData.employerStatus || 'pending_review'];

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div
            style={{
              ...styles.successIcon,
              background:
                setupData.employerStatus === 'approved'
                  ? '#22c55e'
                  : setupData.employerStatus === 'rejected'
                    ? '#ef4444'
                    : '#f59e0b',
            }}
          >
            {setupData.employerStatus === 'approved'
              ? '\u2713'
              : setupData.employerStatus === 'rejected'
                ? '\u2717'
                : '\u23F3'}
          </div>
          <h1 style={styles.successTitle}>{status.title}</h1>
          <p style={styles.successText}>{status.text}</p>
          {status.subtext && (
            <p style={styles.subtextNote}>{status.subtext}</p>
          )}
          {setupData.employerStatus === 'approved' && (
            <a
              href={`/employer/candidates?token=${token}`}
              style={styles.viewCandidatesButton}
            >
              View Candidates
            </a>
          )}
        </div>
      </div>
    );
  }

  // Signup form
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Complete Your Account</h1>
        <p style={styles.subtitle}>
          Someone is interested in your job posting! Set up your account to view
          and connect with candidates.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Full Name *
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="John Smith"
              style={styles.input}
              required
            />
          </label>

          <label style={styles.label}>
            Email *
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="john@company.com"
              style={styles.input}
              required
            />
          </label>

          <label style={styles.label}>
            Phone *
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="+1 555 123 4567"
              style={styles.input}
              required
            />
          </label>

          <label style={styles.label}>
            Company Name *
            <input
              type="text"
              value={formData.company}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, company: e.target.value }))
              }
              placeholder="Acme Inc."
              style={styles.input}
              required
            />
          </label>

          <label style={styles.label}>
            Your Role (optional)
            <input
              type="text"
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              placeholder="Hiring Manager"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Company Website (optional)
            <input
              type="url"
              value={formData.website}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, website: e.target.value }))
              }
              placeholder="https://company.com"
              style={styles.input}
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.submitButton} disabled={submitting}>
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>

          <p style={styles.note}>
            By creating an account, you agree to our Terms of Service and
            Privacy Policy.
          </p>
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
    margin: '0 0 0.5rem 0',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1f2937',
  },
  subtitle: {
    margin: '0 0 1.5rem 0',
    fontSize: '0.875rem',
    color: '#6b7280',
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
    margin: 0,
    textAlign: 'center',
  },
  subtextNote: {
    color: '#059669',
    fontSize: '0.875rem',
    margin: '1rem 0 0 0',
    textAlign: 'center',
    fontWeight: 500,
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
  input: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.875rem',
    margin: 0,
    padding: '0.5rem',
    background: '#fef2f2',
    borderRadius: '0.5rem',
  },
  note: {
    fontSize: '0.75rem',
    color: '#6b7280',
    margin: 0,
    textAlign: 'center',
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
  viewCandidatesButton: {
    display: 'inline-block',
    marginTop: '1.5rem',
    background: '#22c55e',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: 500,
    textDecoration: 'none',
    textAlign: 'center',
  },
};
