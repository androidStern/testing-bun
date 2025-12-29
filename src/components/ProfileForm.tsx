import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { User } from '@workos/authkit-tanstack-react-start';
import { useAction } from 'convex/react';
import {
  Sparkles,
  ChevronDown,
  Globe,
  Linkedin,
  Instagram,
  FileText,
  MapPin,
} from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/convex/_generated/api';
import type { ProfileFormData } from '@/lib/schemas/profile';
import { profileFormSchema } from '@/lib/schemas/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const OFFER_OPTIONS = [
  { emoji: '🔍', value: 'To find a job', description: 'Browse job opportunities' },
  { emoji: '🤝', value: 'To lend a hand', description: 'Help others in recovery' },
  { emoji: '💼', value: 'To post a job', description: 'Hire from our community' },
  { emoji: '🚀', value: 'Entrepreneurship', description: 'Start or grow a business' },
] as const;

interface ProfileFormProps {
  user: User;
  onSuccess?: () => void;
  referredByCode?: string;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error instanceof z.ZodError) {
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

const checkRateLimit = (): boolean => {
  const storageKey = '_resume_polish_cache';
  const maxRequests = 5;
  const timeWindow = 60 * 1000;

  try {
    const stored = localStorage.getItem(storageKey);
    const timestamps: number[] = stored ? JSON.parse(stored) : [];
    const now = Date.now();
    const recentTimestamps = timestamps.filter((ts) => now - ts < timeWindow);

    if (recentTimestamps.length >= maxRequests) {
      return false;
    }

    recentTimestamps.push(now);
    localStorage.setItem(storageKey, JSON.stringify(recentTimestamps));
    return true;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true;
  }
};

export function ProfileForm({ user, onSuccess, referredByCode }: ProfileFormProps) {
  const [isPolishing, setIsPolishing] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const { toast } = useToast();
  const polishWithAI = useAction(api.resumes.polishWithAI);

  const { data: existingProfile } = useSuspenseQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id }),
  );

  const { mutate: createProfile, isPending } = useMutation({
    mutationFn: useConvexMutation(api.profiles.create),
    onSuccess: () => {
      toast({
        title: 'Profile saved',
        description: 'Your profile has been updated successfully.',
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to save profile',
        description: error?.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  const defaultValues: ProfileFormData = {
    bio: existingProfile?.bio ?? '',
    headline: existingProfile?.headline ?? '',
    instagramUrl: existingProfile?.instagramUrl ?? '',
    linkedinUrl: existingProfile?.linkedinUrl ?? '',
    location: existingProfile?.location ?? '',
    resumeLink: existingProfile?.resumeLink ?? '',
    thingsICanOffer: existingProfile?.thingsICanOffer ?? [],
    website: existingProfile?.website ?? '',
  };

  // Show optional fields if any are filled
  const hasOptionalData =
    existingProfile?.resumeLink ||
    existingProfile?.location ||
    existingProfile?.website ||
    existingProfile?.linkedinUrl ||
    existingProfile?.instagramUrl;

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      createProfile({
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        workosUserId: user.id,
        referredByCode,
        ...value,
      });
    },
  });

  const polishBioWithAI = async () => {
    if (!checkRateLimit()) {
      toast({
        description: 'You have reached your limit. Please try again later.',
        title: 'Rate limit reached',
        variant: 'destructive',
      });
      return;
    }

    setIsPolishing(true);
    try {
      const values = form.state.values;
      const result = await polishWithAI({
        context: {
          personalInfo: {
            location: values.location,
            name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          },
          skills: '',
          workExperience: values.headline
            ? [
                {
                  achievements: '',
                  company: '',
                  description: '',
                  endDate: '',
                  position: values.headline,
                  startDate: '',
                },
              ]
            : [],
        },
        currentText: values.bio,
        type: 'summary',
      });
      form.setFieldValue('bio', result.polishedText);
      toast({
        description: 'Your professional summary has been enhanced.',
        title: 'Summary polished',
      });
    } catch (error) {
      console.error('Error polishing bio:', error);
      toast({
        description: 'Failed to polish summary. Please try again.',
        title: 'Error',
        variant: 'destructive',
      });
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingProfile ? 'Your Profile' : 'Complete Your Profile'}
        </CardTitle>
        <CardDescription>
          {existingProfile
            ? 'Update your information to help others connect with you'
            : 'Tell us about yourself to personalize your experience'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          {/* What brings you here */}
          <form.Field
            name="thingsICanOffer"
            validators={{
              onBlur: ({ value }) =>
                value.length === 0 ? 'Please select at least one option' : undefined,
              onChange: ({ value }) =>
                value.length === 0 ? 'Please select at least one option' : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-3">
                <Label>
                  What brings you here? <span className="text-destructive">*</span>
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OFFER_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        checked={field.state.value.includes(option.value)}
                        onCheckedChange={(checked) => {
                          const currentValues = field.state.value;
                          if (checked) {
                            field.handleChange([...currentValues, option.value]);
                          } else {
                            field.handleChange(
                              currentValues.filter((v) => v !== option.value),
                            );
                          }
                        }}
                      />
                      <span className="text-lg">{option.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{option.value}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Most Recent Position */}
          <form.Field
            name="headline"
            validators={{
              onBlur: ({ value }) =>
                !value || value.trim() === ''
                  ? 'Please enter your most recent position'
                  : undefined,
              onChange: ({ value }) =>
                !value || value.trim() === ''
                  ? 'Please enter your most recent position'
                  : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="headline">
                  Most Recent Position <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="headline"
                  placeholder="e.g., Store clerk - 3+ years or Student"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Professional Summary */}
          <form.Field
            name="bio"
            validators={{
              onBlur: ({ value }) =>
                !value || value.trim() === ''
                  ? 'Please enter a professional summary'
                  : undefined,
              onChange: ({ value }) =>
                !value || value.trim() === ''
                  ? 'Please enter a professional summary'
                  : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">
                    Professional Summary <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={polishBioWithAI}
                    disabled={isPolishing || !field.state.value}
                    className="h-8 gap-1.5 text-primary"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isPolishing ? 'Polishing...' : 'Polish with AI'}
                  </Button>
                </div>
                <Textarea
                  id="bio"
                  placeholder="Tell us about your background and expertise..."
                  rows={4}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Optional Fields Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="flex w-full items-center justify-between rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <span>Additional information (optional)</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showOptionalFields || hasOptionalData ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Optional Fields */}
          {(showOptionalFields || hasOptionalData) && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <form.Field name="location">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </Label>
                    <Input
                      id="location"
                      placeholder="e.g., Miami, FL"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="resumeLink">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="resumeLink" className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Resume Link
                    </Label>
                    <Input
                      id="resumeLink"
                      type="url"
                      placeholder="https://example.com/resume.pdf"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="website">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="linkedinUrl">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                      <Linkedin className="h-3.5 w-3.5" />
                      LinkedIn
                    </Label>
                    <Input
                      id="linkedinUrl"
                      type="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="instagramUrl">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                      <Instagram className="h-3.5 w-3.5" />
                      Instagram
                    </Label>
                    <Input
                      id="instagramUrl"
                      type="url"
                      placeholder="https://instagram.com/yourprofile"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                )}
              </form.Field>
            </div>
          )}

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              values: state.values,
            })}
          >
            {({ isSubmitting, values }) => {
              const isValid =
                values.thingsICanOffer.length > 0 &&
                values.headline.trim() !== '' &&
                values.bio.trim() !== '';
              return (
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isPending || isSubmitting || !isValid}
                >
                  {isPending || isSubmitting
                    ? 'Saving...'
                    : existingProfile
                      ? 'Save Changes'
                      : 'Save & Continue'}
                </Button>
              );
            }}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
