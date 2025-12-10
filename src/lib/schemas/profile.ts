import { z } from 'zod';

// Transform empty strings to undefined for optional fields
const optionalString = z
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().optional());

// URL that allows empty strings (transforms to undefined) or valid URLs
const optionalUrl = z
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().url('Please enter a valid URL').optional());

// Shared schema used by both client (TanStack Form) and server (Convex)
export const profileFormSchema = z.object({
  thingsICanOffer: z
    .array(z.string())
    .min(1, 'Please select at least one option for "What brings you here?"'),
  headline: z.string().min(1, 'Please enter your most recent position'),
  bio: z.string().min(1, 'Please enter a professional summary'),
  resumeLink: optionalUrl,
  location: optionalString,
  website: optionalUrl,
  instagramUrl: optionalUrl,
  linkedinUrl: optionalUrl,
});

// Extended schema for mutations that require user identification
export const profileMutationSchema = profileFormSchema.extend({
  workosUserId: z.string().min(1),
  email: z.string().email(),
  firstName: optionalString,
  lastName: optionalString,
  // Optional referral code from the person who referred this user
  referredByCode: z.string().optional(),
});

// Type exports for use throughout the app
export type ProfileFormData = z.input<typeof profileFormSchema>;
export type ProfileFormOutput = z.output<typeof profileFormSchema>;
export type ProfileMutationData = z.input<typeof profileMutationSchema>;
