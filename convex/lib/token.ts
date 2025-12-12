// Token payload for employer flows
export interface MagicToken {
  submissionId: string;
  senderId: string;
  exp: number;
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
