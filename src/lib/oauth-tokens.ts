import { nanoid } from 'nanoid';

// Constant-time string comparison to prevent timing attacks
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const arrA = encoder.encode(a);
  const arrB = encoder.encode(b);

  const maxLength = Math.max(arrA.length, arrB.length);
  let diff = arrA.length !== arrB.length ? 1 : 0;

  for (let i = 0; i < maxLength; i++) {
    const byteA = i < arrA.length ? arrA[i] : 0;
    const byteB = i < arrB.length ? arrB[i] : 0;
    diff |= byteA ^ byteB;
  }

  return diff === 0;
}

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
    return timingSafeEqual(codeVerifier, codeChallenge);
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

    return timingSafeEqual(base64url, codeChallenge);
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
