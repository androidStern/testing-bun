import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { ReferralCard } from '../../components/ReferralCard'

export const Route = createFileRoute('/_authenticated/invite')({
  loader: async ({ context }) => {
    const { user } = await getAuth()

    if (user) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.referrals.getMyReferralStats, { workosUserId: user.id }),
      )
    }

    return { user }
  },
  component: InvitePage,
})

function InvitePage() {
  const { user } = Route.useLoaderData()

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
          Invite Friends
        </h1>
        <ReferralCard workosUserId={user.id} />
      </div>
    </div>
  )
}
