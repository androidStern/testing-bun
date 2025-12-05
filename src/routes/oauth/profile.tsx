import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { useConvexMutation } from '@convex-dev/react-query';
import { useState } from 'react';
import { api } from '../../../convex/_generated/api';

export const Route = createFileRoute('/oauth/profile')({
  loader: async () => {
    const auth = await getAuth();

    if (!auth.user) {
      throw redirect({ to: '/' });
    }

    return {
      user: auth.user,
    };
  },
  component: ProfileForm,
});

const OFFER_OPTIONS = [
  { value: 'To find a job', emoji: '🔍' },
  { value: 'To lend a hand', emoji: '🤝' },
  { value: 'To post a job', emoji: '💼' },
  { value: 'Entrepreneurship', emoji: '🚀' },
];

function ProfileForm() {
  const { user } = Route.useLoaderData();

  const { mutate: createProfile, isPending } = useMutation({
    mutationFn: useConvexMutation(api.profiles.create),
    onSuccess: () => {
      // Full page redirect to hit server handler
      window.location.href = '/oauth/complete';
    },
  });

  const [formData, setFormData] = useState({
    thingsICanOffer: [] as Array<string>,
    headline: '',
    bio: '',
    resumeLink: '',
    location: '',
    website: '',
    instagramUrl: '',
    linkedinUrl: '',
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Complete Your Profile
        </h1>
        <p className="text-gray-600 mb-8">
          Help us personalize your experience by telling us a bit about
          yourself.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Things I Can Offer - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What brings you here? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {OFFER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.thingsICanOffer.includes(option.value)}
                    onChange={() => handleOfferChange(option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-lg">{option.emoji}</span>
                  <span className="text-gray-700">{option.value}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Most Recent Position
            </label>
            <input
              type="text"
              value={formData.headline}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, headline: e.target.value }))
              }
              placeholder="e.g., Store clerk - 3+ years or Student"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Professional Summary
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="Tell us about your background and expertise..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Resume Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resume Link
            </label>
            <input
              type="url"
              value={formData.resumeLink}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, resumeLink: e.target.value }))
              }
              placeholder="Google Drive link, LinkedIn URL, or other"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location: e.target.value }))
              }
              placeholder="City, Country"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, website: e.target.value }))
              }
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instagram URL
              </label>
              <input
                type="url"
                value={formData.instagramUrl}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    instagramUrl: e.target.value,
                  }))
                }
                placeholder="https://instagram.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    linkedinUrl: e.target.value,
                  }))
                }
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving...' : 'Save & Continue'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-gray-600 px-6 py-2 hover:underline"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
