import { parse, serialize } from 'cookie';

const OAUTH_SESSION_COOKIE = 'oauth_session';

export interface OAuthSessionData {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope?: string;
  createdAt: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.OAUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('OAUTH_SESSION_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret.slice(0, 32));
}

export async function encryptSession(data: OAuthSessionData): Promise<string> {
  const encoder = new TextEncoder();
  const secret = getSecret();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secret.buffer as ArrayBuffer,
    'AES-GCM',
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    keyMaterial,
    encoder.encode(JSON.stringify(data)),
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptSession(
  encrypted: string,
): Promise<OAuthSessionData | null> {
  try {
    const decoder = new TextDecoder();

    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const secret = getSecret();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secret.buffer as ArrayBuffer,
      'AES-GCM',
      false,
      ['decrypt'],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer },
      keyMaterial,
      data.buffer,
    );

    return JSON.parse(decoder.decode(decrypted));
  } catch {
    return null;
  }
}

export function setOAuthSessionCookie(
  headers: Headers,
  encrypted: string,
): void {
  const cookie = serialize(OAUTH_SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  headers.append('Set-Cookie', cookie);
}

export function getOAuthSessionFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = parse(cookieHeader);
  return cookies[OAUTH_SESSION_COOKIE] || null;
}

export function clearOAuthSessionCookie(headers: Headers): void {
  const cookie = serialize(OAUTH_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  headers.append('Set-Cookie', cookie);
}
