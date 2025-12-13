import { timingSafeEqual } from './crypto';
import { env } from './env';

// Token payload for employer flows
// HMAC-SHA256 signed for security
export interface MagicToken {
  submissionId: string;
  senderId: string;
  exp: number;
}

// Convert string to Uint8Array
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to base64url string
function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert base64url string to Uint8Array
function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Compute HMAC-SHA256 signature
async function computeSignature(payload: string, secret: string): Promise<Uint8Array> {
  const secretBytes = stringToBytes(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payloadBytes = stringToBytes(payload);
  const signature = await crypto.subtle.sign('HMAC', key, payloadBytes.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

// Create a signed magic token for employer flows (7-day expiry by default)
// Token format: base64url(payload).base64url(signature)
export async function createToken(
  submissionId: string,
  senderId: string,
  expiryMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): Promise<string> {
  const payload: MagicToken = {
    submissionId,
    senderId,
    exp: Date.now() + expiryMs,
  };
  const json = JSON.stringify(payload);
  const payloadBase64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Compute HMAC signature
  const signature = await computeSignature(payloadBase64, env.TOKEN_SIGNING_SECRET);
  const signatureBase64 = bytesToBase64Url(signature);

  return `${payloadBase64}.${signatureBase64}`;
}

// Parse and validate a signed token
// Returns null if token is invalid, expired, or signature doesn't match
export async function parseToken(token: string): Promise<MagicToken | null> {
  try {
    // Split into payload and signature
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signatureBase64] = parts;

    // Verify signature first (constant-time comparison)
    const expectedSignature = await computeSignature(payloadBase64, env.TOKEN_SIGNING_SECRET);
    const providedSignature = base64UrlToBytes(signatureBase64);

    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      return null;
    }

    // Signature valid - now decode payload
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const data = JSON.parse(json) as MagicToken;

    if (!data.submissionId || !data.senderId || !data.exp) return null;

    return data;
  } catch {
    return null;
  }
}
