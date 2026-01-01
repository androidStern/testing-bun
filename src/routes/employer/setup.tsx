import { useEffect, useState } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { CheckCircle2, Clock, Eye } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type StepStatus = 'completed' | 'current' | 'pending';

function ProgressStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { number: 1, label: 'Job Posted', icon: CheckCircle2 },
    { number: 2, label: 'Verify Account', icon: Clock },
    { number: 3, label: 'View Candidates', icon: Eye },
  ];

  const getStatus = (stepNumber: number): StepStatus => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'pending';
  };

  return (
    <div className="flex items-center justify-center mb-6">
      {steps.map((step, index) => {
        const status = getStatus(step.number);
        const Icon = step.icon;
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  status === 'completed' && 'bg-primary text-primary-foreground',
                  status === 'current' && 'bg-accent text-accent-foreground ring-2 ring-primary',
                  status === 'pending' && 'bg-muted text-muted-foreground'
                )}
              >
                {status === 'completed' ? '✓' : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={cn(
                  'text-xs text-center max-w-20',
                  status === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                  status === 'current' && 'font-medium'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-2 mb-5',
                  status === 'completed' ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setSubmitting(false);
    }
  };

  // Loading
  if (setupData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (setupData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid or Expired Link</CardTitle>
            <CardDescription>
              This setup link is no longer valid. If you received a notification about an interested candidate, please contact support for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Already set up
  if (setupData.alreadySetup) {
    const isPending = setupData.employerStatus === 'pending_review';
    const isApproved = setupData.employerStatus === 'approved';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <ProgressStepper currentStep={isApproved ? 3 : 2} />
          <Card>
            <CardHeader className="text-center">
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-2',
                  isApproved ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
                )}
              >
                {isApproved ? '✓' : '⏳'}
              </div>
              <CardTitle>
                {isPending ? "We're Reviewing Your Account" : isApproved ? "You're All Set!" : 'Account Not Approved'}
              </CardTitle>
              <CardDescription>
                {isPending && 'Our team is verifying your information. This typically takes less than 24 hours.'}
                {isApproved && 'Your account has been approved. You can now view and connect with candidates.'}
                {!isPending && !isApproved && 'Please contact support if you believe this is an error.'}
              </CardDescription>
            </CardHeader>
            {isPending && (
              <CardContent>
                <p className="text-sm text-center text-primary font-medium">
                  You have candidates waiting! We'll email you as soon as you're approved.
                </p>
              </CardContent>
            )}
            {isApproved && (
              <CardContent className="flex justify-center">
                <Button asChild>
                  <a href={`/employer/candidates?token=${token}`}>View Candidates</a>
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Signup form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <ProgressStepper currentStep={2} />
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Profile</CardTitle>
            <CardDescription>
              A candidate is interested in your position! Complete this quick form so our team can verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-accent/50 border border-accent p-4 mb-6">
              <p className="text-sm font-medium text-accent-foreground mb-2">What happens next?</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Submit this form (takes 2 minutes)</li>
                <li>Our team reviews your account within 24 hours</li>
                <li>Once approved, we'll email you a link to view candidates</li>
              </ol>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="john@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 555 123 4567"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company Name *</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                  placeholder="Acme Inc."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Your Role (optional)</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="Hiring Manager"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Company Website (optional)</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                  placeholder="https://company.com"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-2">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
