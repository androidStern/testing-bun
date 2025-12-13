// Constant-time string/buffer comparison to prevent timing attacks
// Based on https://codahale.com/a-lesson-in-timing-attacks/
export function timingSafeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
  if (!a?.length || !b?.length) return false;
  const arrA = typeof a === 'string' ? a.split('') : Array.from(a);
  const arrB = typeof b === 'string' ? b.split('') : Array.from(b);
  let diff = arrA.length !== arrB.length ? 1 : 0;
  for (let i = 0; i < arrB.length; i++) {
    diff |= arrA[i] !== arrB[i] ? 1 : 0;
  }
  return diff === 0;
}
