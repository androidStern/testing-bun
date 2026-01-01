import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link2, Copy, Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ReferralCardProps {
  workosUserId: string;
}

export function ReferralCard({ workosUserId }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.referrals.getMyReferralStats, { workosUserId }),
  );

  if (!stats) return null;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${stats.code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!', {
        description: 'Share it with friends to invite them.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed', {
        description: 'Please copy the link manually.',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Invite Friends</CardTitle>
            <CardDescription>
              Share your invite link to grow the community
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            readOnly
            value={shareUrl}
            className="font-mono text-sm"
          />
          <Button
            onClick={handleCopy}
            variant={copied ? 'secondary' : 'default'}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            <span className="font-medium text-foreground">{stats.totalReferrals}</span>{' '}
            {stats.totalReferrals === 1 ? 'person' : 'people'} joined with your link
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
