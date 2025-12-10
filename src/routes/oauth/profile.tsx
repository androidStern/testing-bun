import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '../../../convex/_generated/api';
import { ProfileForm } from '../../components/ProfileForm';

import type { ErrorComponentProps } from '@tanstack/react-router';

function ProfileError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-destructive mb-4">
          Failed to Load Profile
        </h1>
        <p className="text-muted-foreground mb-6">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/oauth/profile')({
  errorComponent: ProfileError,
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === 'string' ? search.ref : undefined,
  }),
  loader: async ({ context }) => {
    const auth = await getAuth();

    if (!auth.user) {
      throw redirect({ to: '/' });
    }

    // Preload profile data - useSuspenseQuery won't suspend since data is cached
    await context.queryClient.ensureQueryData(
      convexQuery(api.profiles.getByWorkosUserId, {
        workosUserId: auth.user.id,
      }),
    );

    return {
      user: auth.user,
    };
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useLoaderData();
  const { ref } = Route.useSearch();

  const handleSuccess = () => {
    window.location.href = '/oauth/complete';
  };

  return <ProfileForm user={user} onSuccess={handleSuccess} referredByCode={ref} />;
}
