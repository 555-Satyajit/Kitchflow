/**
 * KitchFlow OS — Cryptographic Session Token Signer & Verifier
 * Powered by standard Web Crypto API (HMAC-SHA256) for universal compatibility
 * across Node.js runtime, Vercel Edge, Next.js Middleware, and Server Actions.
 */

export interface StaffSessionPayload {
  memberId: string;
  userId: string;
  name: string;
  role: string;
  organizationId: string;
  kitchenId: string | null;
  kitchenName: string | null;
  permissions: string[];
  issuedAt?: number;
  expiresAt?: number;
}

const DEFAULT_DEV_SECRET = 'kitchflow-dev-insecure-session-key-local-only';

function getSessionSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: Cryptographic session secret is missing in production. Set AUTH_SECRET, NEXTAUTH_SECRET, or SUPABASE_JWT_SECRET in your environment.'
    );
  }

  return DEFAULT_DEV_SECRET;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Creates an HMAC-SHA256 cryptographically signed token string.
 * Format: `<base64url(payload)>.<base64url(signature)>`
 */
export async function signSessionToken(
  payload: StaffSessionPayload,
  maxAgeSeconds: number = 60 * 60 * 24 * 7 // 7 days default
): Promise<string> {
  const now = Date.now();
  const enrichedPayload: StaffSessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + maxAgeSeconds * 1000,
  };

  const jsonStr = JSON.stringify(enrichedPayload);
  const encoder = new TextEncoder();
  const payloadEncoded = base64UrlEncode(encoder.encode(jsonStr));

  const key = await getHmacKey(getSessionSecret());
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payloadEncoded)
  );

  const signatureEncoded = base64UrlEncode(signatureBuffer);
  return `${payloadEncoded}.${signatureEncoded}`;
}

/**
 * Verifies the cryptographic signature and expiration of a session token.
 * Returns the verified payload or null if invalid, expired, or tampered.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<StaffSessionPayload | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  // Backward compatibility: If the stored value is legacy raw JSON, attempt parse
  // and return it (it will be upgraded on next login)
  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token);
      if (parsed?.memberId && parsed?.organizationId) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signatureEncoded] = parts;

  try {
    const key = await getHmacKey(getSessionSecret());
    const encoder = new TextEncoder();
    const signatureBytes = base64UrlDecode(signatureEncoded);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      encoder.encode(payloadEncoded)
    );

    if (!isValid) {
      console.warn('Session signature verification failed (tampered or forged token).');
      return null;
    }

    const payloadBytes = base64UrlDecode(payloadEncoded);
    const decoder = new TextDecoder();
    const payload: StaffSessionPayload = JSON.parse(decoder.decode(payloadBytes));

    // Check expiration
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch (err) {
    console.warn('Session verification exception:', err);
    return null;
  }
}
