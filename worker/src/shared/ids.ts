import { ID_BYTES, TOKEN_BYTES } from '@shared/schema';

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** Unguessable 128-bit item id. */
export function generateId(): string {
  return randomBase64Url(ID_BYTES);
}

/** 256-bit bearer token (e.g. delete token). Only its hash is ever stored. */
export function generateToken(): string {
  return randomBase64Url(TOKEN_BYTES);
}

/** SHA-256 of a high-entropy token. A plain hash is enough because tokens are 256-bit random. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Constant-time string comparison. Length mismatch still does a full comparison before failing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) {
    crypto.subtle.timingSafeEqual(left, left);
    return false;
  }
  return crypto.subtle.timingSafeEqual(left, right);
}

/** Opaque per-request id for correlating logs and error responses. */
export function generateRequestId(): string {
  return randomBase64Url(12);
}
