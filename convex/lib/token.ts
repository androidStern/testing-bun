// Token payload for employer flows
// TODO: Add HMAC signing before production (see Security TODOs in spec)
export interface MagicToken {
  submissionId: string;
  senderId: string;
  exp: number;
}

// Create a magic token for employer flows (7-day expiry by default)
// WARNING: Not cryptographically signed - see Security TODOs
export function createToken(
  submissionId: string,
  senderId: string,
  expiryMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): string {
  const payload: MagicToken = {
    submissionId,
    senderId,
    exp: Date.now() + expiryMs,
  };
  const json = JSON.stringify(payload);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Parse and validate base64url-encoded token
export function parseToken(token: string): MagicToken | null {
  try {
    // Convert base64url to base64
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    // Decode base64 to string
    const json = atob(base64);
    const data = JSON.parse(json) as MagicToken;
    if (!data.submissionId || !data.senderId || !data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
