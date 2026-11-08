const ITERATIONS = 210000;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export type PasswordValidationKey =
  | 'validation.passwordShort'
  | 'validation.passwordMismatch'
  | 'validation.passwordSame';

export function validatePasswordChange(currentPassword: string, newPassword: string, confirmation: string): PasswordValidationKey | null {
  if (newPassword.length < 6) return 'validation.passwordShort';
  if (newPassword !== confirmation) return 'validation.passwordMismatch';
  if (newPassword === currentPassword) return 'validation.passwordSame';
  return null;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !saltHex || !hashHex) return false;
  const derived = await derive(password, fromHex(saltHex), Number(iterations));
  return toHex(derived) === hashHex;
}

export async function changePasswordHash(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
  storedHash: string,
): Promise<string> {
  if (!(await verifyPassword(currentPassword, storedHash))) throw new Error('current-password-incorrect');
  const validationError = validatePasswordChange(currentPassword, newPassword, confirmation);
  if (validationError) throw new Error(validationError);
  return hashPassword(newPassword);
}