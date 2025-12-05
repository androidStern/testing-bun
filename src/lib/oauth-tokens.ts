import { nanoid } from 'nanoid';

export function generateAuthorizationCode(): string {
  return nanoid(32);
}

export function generateAccessToken(): string {
  return nanoid(64);
}

export function generateRefreshToken(): string {
  return nanoid(64);
}

export async function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string,
): Promise<boolean> {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  if (method === 'S256') {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    // Base64url encode
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    const base64url = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return base64url === codeChallenge;
  }

  return false;
}

export async function hashClientSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
