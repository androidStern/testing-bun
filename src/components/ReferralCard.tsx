import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '../../convex/_generated/api';

interface ReferralCardProps {
  workosUserId: string;
}

export function ReferralCard({ workosUserId }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.referrals.getMyReferralStats, { workosUserId }),
  );

  if (!stats) return null;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${stats.code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share it with friends to invite them.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔗</span>
        <h3 className="font-semibold text-lg text-foreground">Invite Friends</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Share your personal invite link to help others join the community.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          readOnly
          value={shareUrl}
          className="flex-1 px-3 py-2 bg-background rounded-lg border border-border text-sm font-mono truncate"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-primary">{stats.totalReferrals}</span>{' '}
        {stats.totalReferrals === 1 ? 'person' : 'people'} joined with your link
      </div>
    </div>
  );
}
