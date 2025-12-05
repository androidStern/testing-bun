import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { User } from '@workos/authkit-tanstack-react-start';

const OFFER_OPTIONS = [
  { value: 'To find a job', emoji: '🔍' },
  { value: 'To lend a hand', emoji: '🤝' },
  { value: 'To post a job', emoji: '💼' },
  { value: 'Entrepreneurship', emoji: '🚀' },
];

interface ProfileFormProps {
  user: User;
  onSuccess?: () => void;
  showSkip?: boolean;
}

export function ProfileForm({ user, onSuccess, showSkip = true }: ProfileFormProps) {
  const { mutate: createProfile, isPending, isSuccess } = useMutation({
    mutationFn: useConvexMutation(api.profiles.create),
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const [formData, setFormData] = useState({
    thingsICanOffer: [] as Array<string>,
    headline: '',
    bio: '',
  });

  const [error, setError] = useState<string | null>(null);

  const handleOfferChange = (option: string) => {
    setFormData((prev) => ({
      ...prev,
      thingsICanOffer: prev.thingsICanOffer.includes(option)
        ? prev.thingsICanOffer.filter((o) => o !== option)
        : [...prev.thingsICanOffer, option],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.thingsICanOffer.length === 0) {
      setError('Please select at least one option for "What brings you here?"');
      return;
    }

    setError(null);

    createProfile({
      workosUserId: user.id,
      email: user.email,
      ...formData,
    });
  };

  const handleSkip = () => {
    window.location.href = '/oauth/complete';
  };

  if (isSuccess) {
    return (
      <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4">Profile Saved!</h1>
          <p className="text-muted-foreground">Your profile has been updated successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-2">
          Complete Your Profile
        </h1>
        <p className="text-muted-foreground mb-6 sm:mb-8">
          Help us personalize your experience by telling us a bit about yourself.
        </p>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Things I Can Offer - Required */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              What brings you here? <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {OFFER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.thingsICanOffer.includes(option.value)}
                    onChange={() => handleOfferChange(option.value)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring focus:ring-offset-0"
                  />
                  <span className="text-lg">{option.emoji}</span>
                  <span className="text-foreground">{option.value}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Most Recent Position
            </label>
            <input
              type="text"
              value={formData.headline}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, headline: e.target.value }))
              }
              placeholder="e.g., Store clerk - 3+ years or Student"
              className="bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Professional Summary
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="Tell us about your background and expertise..."
              rows={4}
              className="bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving...' : 'Save & Continue'}
            </button>
            {showSkip && (
              <button
                type="button"
                onClick={handleSkip}
                className="w-full sm:w-auto text-muted-foreground px-6 py-2.5 hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
