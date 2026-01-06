import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start-server'
import type { User } from '@workos/authkit-tanstack-react-start'
import { getAuth, getSignInUrl, getSignUpUrl } from '@workos/authkit-tanstack-react-start'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { Authenticated, Unauthenticated } from 'convex/react'
import { LogOut } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { HomeLocationCard } from '@/components/HomeLocationCard'
import { ProfileForm } from '@/components/ProfileForm'
import { ReferralCard } from '@/components/ReferralCard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'

// Server function to read referral cookie (loaders are isomorphic, so we need this)
const getReferralCookie = createServerFn({ method: 'GET' }).handler(async () => {
  return getCookie('pending_referral') || null
})

export const Route = createFileRoute('/')({
  component: Home,
  loader: async ({ context }) => {
    const { user } = await getAuth()
    const signInUrl = await getSignInUrl()
    const signUpUrl = await getSignUpUrl()

    // Read referral cookie for direct signups (non-OAuth flow)
    const referralCode = await getReferralCookie()

    if (user) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id }),
      )
    }

    return { referralCode, signInUrl, signUpUrl, user }
  },
})

function Home() {
  const { user, signInUrl, signUpUrl, referralCode } = Route.useLoaderData()
  return (
    <HomeContent
      referralCode={referralCode}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      user={user}
    />
  )
}

function HomeContent({
  user,
  signInUrl,
  signUpUrl,
  referralCode,
}: {
  user: User | null
  signInUrl: string
  signUpUrl: string
  referralCode: string | null
}) {
  return (
    <div className='min-h-screen bg-background'>
      <header className='sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60'>
        <div className='mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6'>
          <span className='font-semibold text-foreground'>Recovery Jobs</span>
          <div className='flex items-center gap-2'>
            <ThemeToggle />
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </header>
      <AuthDebug />
      <main className='mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8'>
        <Authenticated>
          {user && <ProfileDashboard referralCode={referralCode} user={user} />}
        </Authenticated>
        <Unauthenticated>
          <WelcomeScreen signInUrl={signInUrl} signUpUrl={signUpUrl} />
        </Unauthenticated>
      </main>
    </div>
  )
}

function ProfileDashboard({ user, referralCode }: { user: User; referralCode: string | null }) {
  const { data: profile } = useQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id }),
  )

  const hasProfile = !!profile

  return (
    <div className='space-y-6'>
      {/* Profile Form - always shown */}
      <ProfileForm referredByCode={referralCode ?? undefined} user={user} />

      {/* Only show these cards after profile exists */}
      {hasProfile && (
        <>
          <HomeLocationCard workosUserId={user.id} />
          <Suspense fallback={null}>
            <ReferralCard workosUserId={user.id} />
          </Suspense>
        </>
      )}
    </div>
  )
}

function WelcomeScreen({ signInUrl, signUpUrl }: { signInUrl: string; signUpUrl: string }) {
  return (
    <div className='flex min-h-[calc(100vh-theme(spacing.16))] flex-col items-center justify-center gap-6 text-center'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>Welcome to Recovery Jobs</h1>
        <p className='text-lg text-muted-foreground'>
          Sign in to access your profile and find opportunities
        </p>
      </div>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <Button asChild size='lg'>
          <a href={signInUrl}>Sign in</a>
        </Button>
        <Button asChild size='lg' variant='outline'>
          <a href={signUpUrl}>Create account</a>
        </Button>
      </div>
    </div>
  )
}

function UserMenu({ user }: { user: User }) {
  const { signOut } = useAuth()

  return (
    <div className='flex items-center gap-3'>
      <span className='hidden max-w-[200px] truncate text-sm text-muted-foreground sm:block'>
        {user.email}
      </span>
      <Button onClick={() => signOut()} size='sm' variant='ghost'>
        <LogOut className='h-4 w-4' />
        <span className='hidden sm:inline'>Sign out</span>
      </Button>
    </div>
  )
}

function AuthDebug() {
  const auth = useAuth()

  useEffect(() => {
    console.log('Auth state', { loading: auth.loading, user: auth.user })
  }, [auth.loading, auth.user])

  return null
}
