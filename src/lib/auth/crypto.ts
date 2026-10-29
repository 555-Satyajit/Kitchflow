/**
 * KitchFlow OS — Reversible Authenticated Field Encryption (AES-256-GCM)
 * Built with standard Web Crypto API (SubtleCrypto) for compatibility across
 * Node.js, Vercel Edge, Next.js Server Actions, and Middleware.
 *
 * Used to protect sensitive operational credentials (such as Staff PINs) at rest
 * in the database while allowing authenticated administrators to view and manage them.
 */

const PREFIX = 'enc:gcm:v1:';

const FALLBACK_SECRET =
  process.env.DATABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'kitchflow-hardened-session-cryptographic-secret-v2-2026';

function getEncryptionSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    FALLBACK_SECRET;

  return secret;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(buf: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < buf.length; i++) {
    bin += String.fromCharCode(buf[i]);
  }
  return btoa(bin);
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/**
 * Encrypts a plaintext PIN or sensitive value using AES-256-GCM.
 * Format: `enc:gcm:v1:<base64(iv)>:<base64(ciphertext+tag)>`
 */
export async function encryptPin(plaintext: string): Promise<string> {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  // Already encrypted
  if (plaintext.startsWith(PREFIX)) {
    return plaintext;
  }

  const key = await deriveAesKey(getEncryptionSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  const ivB64 = toBase64(iv);
  const cipherB64 = toBase64(new Uint8Array(encryptedBuffer));

  return `${PREFIX}${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an AES-256-GCM encrypted PIN.
 * If the value is legacy plaintext, returns it as-is for transparent backward-compatibility.
 */
export async function decryptPin(encryptedValue: string | null | undefined): Promise<string> {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    return '';
  }

  // Backward compatibility: If not encrypted with our prefix, it's a legacy plaintext PIN
  if (!encryptedValue.startsWith(PREFIX)) {
    return encryptedValue;
  }

  try {
    const parts = encryptedValue.slice(PREFIX.length).split(':');
    if (parts.length !== 2) {
      return '';
    }

    const [ivB64, cipherB64] = parts;
    const iv = fromBase64(ivB64);
    const cipherBytes = fromBase64(cipherB64);

    const key = await deriveAesKey(getEncryptionSecret());
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      cipherBytes as unknown as BufferSource
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.warn('Failed to decrypt PIN field:', err);
    return '';
  }
}

