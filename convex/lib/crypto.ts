// Constant-time string/buffer comparison to prevent timing attacks
// Based on https://codahale.com/a-lesson-in-timing-attacks/
export function timingSafeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const encoder = new TextEncoder();
  const arrA = typeof a === 'string' ? encoder.encode(a) : a;
  const arrB = typeof b === 'string' ? encoder.encode(b) : b;

  // Always iterate the longer length to avoid timing leaks
  const maxLength = Math.max(arrA.length, arrB.length);

  // XOR accumulator - will be non-zero if any difference found
  let diff = arrA.length !== arrB.length ? 1 : 0;

  for (let i = 0; i < maxLength; i++) {
    // Use 0 for out-of-bounds access (constant-time)
    const byteA = i < arrA.length ? arrA[i] : 0;
    const byteB = i < arrB.length ? arrB[i] : 0;
    diff |= byteA ^ byteB;
  }

  return diff === 0;
}
