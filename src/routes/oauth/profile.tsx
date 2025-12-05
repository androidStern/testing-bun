import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { ProfileForm } from '../../components/ProfileForm';

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
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useLoaderData();

  const handleSuccess = () => {
    window.location.href = '/oauth/complete';
  };

  return <ProfileForm user={user} onSuccess={handleSuccess} showSkip={true} />;
}
