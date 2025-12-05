import { createFileRoute } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useAuth } from '@workos/authkit-tanstack-react-start/client';
import { getAuth, getSignInUrl, getSignUpUrl } from '@workos/authkit-tanstack-react-start';
import { useEffect } from 'react';
import type { User } from '@workos/authkit-tanstack-react-start';
import { ProfileForm } from '../components/ProfileForm';

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    const { user } = await getAuth();
    const signInUrl = await getSignInUrl();
    const signUpUrl = await getSignUpUrl();

    return { user, signInUrl, signUpUrl };
  },
});

function Home() {
  const { user, signInUrl, signUpUrl } = Route.useLoaderData();
  return <HomeContent user={user} signInUrl={signInUrl} signUpUrl={signUpUrl} />;
}

function HomeContent({ user, signInUrl, signUpUrl }: { user: User | null; signInUrl: string; signUpUrl: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <span className="font-semibold text-foreground">Recovery Jobs</span>
          {user && <UserMenu user={user} />}
        </div>
      </header>
      <AuthDebug />
      <main className="flex-1">
        <Authenticated>
          {user && <ProfileForm user={user} showSkip={false} />}
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-53px)] gap-6 px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">Welcome to Recovery Jobs</h1>
            <p className="text-muted-foreground text-center">Sign in to access your profile</p>
            <SignInForm signInUrl={signInUrl} signUpUrl={signUpUrl} />
          </div>
        </Unauthenticated>
      </main>
    </div>
  );
}

function SignInForm({ signInUrl, signUpUrl }: { signInUrl: string; signUpUrl: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
      <a href={signInUrl} className="w-full sm:w-auto">
        <button className="w-full bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors">
          Sign in
        </button>
      </a>
      <a href={signUpUrl} className="w-full sm:w-auto">
        <button className="w-full bg-secondary text-secondary-foreground px-6 py-2.5 rounded-md hover:bg-secondary/80 transition-colors">
          Sign up
        </button>
      </a>
    </div>
  );
}

function UserMenu({ user }: { user: User }) {
  const { signOut } = useAuth();

  return (
    <div className="flex items-center gap-3">
      <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[200px]">
        {user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-md text-sm hover:bg-destructive/90 transition-colors whitespace-nowrap"
      >
        Sign out
      </button>
    </div>
  );
}

function AuthDebug() {
  const auth = useAuth();

  useEffect(() => {
    console.log('Auth state', { loading: auth.loading, user: auth.user });
  }, [auth.loading, auth.user]);

  return null;
}
