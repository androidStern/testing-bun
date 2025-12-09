import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { api } from '../../../convex/_generated/api';

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: async ({ context }) => {
    const isAdmin = await context.queryClient.fetchQuery(
      convexQuery(api.auth.isAdmin, {}),
    );

    if (!isAdmin) {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
