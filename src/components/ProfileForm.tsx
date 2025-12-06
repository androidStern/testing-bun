import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '../../convex/_generated/api';
import { profileFormSchema } from '../lib/schemas/profile';

import type { ProfileFormData } from '../lib/schemas/profile';
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

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error instanceof z.ZodError) {
    // Use issues array directly - more stable across Zod versions
    const firstIssue = error.issues[0];
    if (firstIssue) {
      return firstIssue.message;
    }
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'Validation error';
}

export function ProfileForm({ user, onSuccess, showSkip = true }: ProfileFormProps) {
  const { data: existingProfile } = useSuspenseQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id }),
  );

  const { mutate: createProfile, isPending, isSuccess } = useMutation({
    mutationFn: useConvexMutation(api.profiles.create),
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const defaultValues: ProfileFormData = {
    thingsICanOffer: existingProfile?.thingsICanOffer ?? [],
    headline: existingProfile?.headline ?? '',
    bio: existingProfile?.bio ?? '',
    resumeLink: existingProfile?.resumeLink ?? '',
    location: existingProfile?.location ?? '',
    website: existingProfile?.website ?? '',
    instagramUrl: existingProfile?.instagramUrl ?? '',
    linkedinUrl: existingProfile?.linkedinUrl ?? '',
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: profileFormSchema,
    },
    onSubmit: ({ value }) => {
      createProfile({
        workosUserId: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        ...value,
      });
    },
  });

  const handleSkip = () => {
    window.location.href = '/oauth/complete';
  };

  if (isSuccess) {
    return (
      <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4">
            Profile Saved!
          </h1>
          <p className="text-muted-foreground">
            Your profile has been updated successfully.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-2">
          {existingProfile ? 'Edit Your Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-muted-foreground mb-6 sm:mb-8">
          Help us personalize your experience by telling us a bit about yourself.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5 sm:space-y-6"
        >
          <form.Field name="thingsICanOffer">
            {(field) => (
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
                        checked={field.state.value.includes(option.value)}
                        onChange={(e) => {
                          const currentValues = field.state.value;
                          if (e.target.checked) {
                            field.handleChange([...currentValues, option.value]);
                          } else {
                            field.handleChange(
                              currentValues.filter((v) => v !== option.value),
                            );
                          }
                        }}
                        onBlur={field.handleBlur}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-ring focus:ring-offset-0"
                      />
                      <span className="text-lg">{option.emoji}</span>
                      <span className="text-foreground">{option.value}</span>
                    </label>
                  ))}
                </div>
                {field.state.meta.errors.length > 0 && (
                  <p className="mt-2 text-sm text-destructive">
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="headline">
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Most Recent Position
                </label>
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Store clerk - 3+ years or Student"
                  className="bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="bio">
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Professional Summary
                </label>
                <textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Tell us about your background and expertise..."
                  rows={4}
                  className="bg-input text-foreground w-full px-3 py-2.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.errors}>
            {(errors) =>
              errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm">
                  {errors.map((error, i) => (
                    <p key={i}>{getErrorMessage(error)}</p>
                  ))}
                </div>
              )
            }
          </form.Subscribe>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isPending || isSubmitting}
                  className="w-full sm:w-auto bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPending || isSubmitting ? 'Saving...' : 'Save & Continue'}
                </button>
              )}
            </form.Subscribe>
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
