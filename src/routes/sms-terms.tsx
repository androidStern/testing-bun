import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sms-terms')({
  component: SmsTermsPage,
});

function SmsTermsPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>SMS Terms & Conditions</h1>
        <p style={styles.subtitle}>Recovery Jobs Text Messaging Program</p>

        <section style={styles.section}>
          <h2 style={styles.heading}>How It Works</h2>
          <p style={styles.text}>
            Recovery Jobs allows employers to submit job postings via SMS. By texting a job
            posting to our number, you are initiating contact and consenting to receive
            transactional text messages related to your job posting.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Opt-In</h2>
          <p style={styles.text}>
            You opt-in to receive SMS messages when you text a job posting to our toll-free
            number. We will never send unsolicited messages - all outbound SMS is in direct
            response to your job submission.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Messages You Will Receive</h2>
          <ul style={styles.list}>
            <li>Confirmation that your job posting was received</li>
            <li>Notification when your job is approved and posted</li>
            <li>Alerts when candidates apply to your job</li>
            <li>One-time account setup link to view applicants</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Message Frequency</h2>
          <p style={styles.text}>
            Message frequency varies based on candidate activity. You will only receive
            messages related to jobs you have submitted. Typical usage is 1-5 messages
            per job posting.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Opt-Out</h2>
          <p style={styles.text}>
            Reply <strong>STOP</strong> at any time to close your job posting and stop
            receiving messages. Reply <strong>HELP</strong> for assistance. Once you opt-out,
            you will not receive any further messages unless you submit a new job posting.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Cost</h2>
          <p style={styles.text}>
            Recovery Jobs does not charge for SMS messages. However, message and data rates
            may apply from your mobile carrier.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Privacy</h2>
          <p style={styles.text}>
            Your phone number is used solely for communications about your job postings.
            We do not sell, rent, or share your phone number with third parties for
            marketing purposes. For more information, see our Privacy Policy.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Contact</h2>
          <p style={styles.text}>
            For questions about our SMS program, contact us at{' '}
            <a href="mailto:support@recovery-jobs.com" style={styles.link}>
              support@recovery-jobs.com
            </a>
          </p>
        </section>

        <footer style={styles.footer}>
          <p style={styles.footerText}>
            Last updated: December 2024
          </p>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f9fafb',
    padding: '2rem 1rem',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '1rem',
    padding: '2rem 3rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 0.5rem 0',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#6b7280',
    margin: '0 0 2rem 0',
  },
  section: {
    marginBottom: '1.5rem',
  },
  heading: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1f2937',
    margin: '0 0 0.75rem 0',
  },
  text: {
    fontSize: '1rem',
    lineHeight: 1.7,
    color: '#374151',
    margin: 0,
  },
  list: {
    margin: '0',
    paddingLeft: '1.5rem',
    color: '#374151',
    lineHeight: 1.8,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
  },
  footer: {
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e5e7eb',
  },
  footerText: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    margin: 0,
  },
};
