const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100_000;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface EncryptedPayload {
  format: 'school-admin-encrypted';
  version: 1;
  salt: string;
  iv: string;
  data: string;
  checksum: string;
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  const dataBytes = new Uint8Array(ciphertext);
  const checksumBuffer = await crypto.subtle.digest('SHA-256', enc.encode(plaintext));
  const checksum = toBase64(new Uint8Array(checksumBuffer));
  const payload: EncryptedPayload = {
    format: 'school-admin-encrypted',
    version: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(dataBytes),
    checksum,
  };
  return JSON.stringify(payload);
}

export async function decryptBackup(encryptedJson: string, passphrase: string): Promise<string | null> {
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encryptedJson);
  } catch {
    return null;
  }
  if (payload.format !== 'school-admin-encrypted' || payload.version !== 1) return null;
  try {
    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const data = fromBase64(payload.data);
    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    const plaintext = new TextDecoder().decode(decrypted);
    const enc = new TextEncoder();
    const checksumBuffer = await crypto.subtle.digest('SHA-256', enc.encode(plaintext));
    if (toBase64(new Uint8Array(checksumBuffer)) !== payload.checksum) return null;
    return plaintext;
  } catch {
    return null;
  }
}
