import { parse, serialize } from 'cookie';

const REFERRAL_COOKIE = 'pending_referral';
// Referral attribution window: 24 hours
// Users must complete signup within this window to be attributed to their referrer
const COOKIE_MAX_AGE = 60 * 60 * 24;

export function setReferralCookie(headers: Headers, code: string): void {
  const cookie = serialize(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  headers.append('Set-Cookie', cookie);
}

export function getReferralFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = parse(cookieHeader);
  return cookies[REFERRAL_COOKIE] || null;
}

export function clearReferralCookie(headers: Headers): void {
  const cookie = serialize(REFERRAL_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  headers.append('Set-Cookie', cookie);
}
