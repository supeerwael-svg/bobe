import { describe, expect, it } from 'vitest';
import { changePasswordHash, hashPassword, validatePasswordChange, verifyPassword } from '@/utils/password';

describe('validatePasswordChange', () => {
  it('rejects a password shorter than six characters', () => {
    expect(validatePasswordChange('current', 'short', 'short')).toBe('validation.passwordShort');
  });

  it('rejects mismatched confirmation', () => {
    expect(validatePasswordChange('current', 'new-password', 'different')).toBe('validation.passwordMismatch');
  });

  it('rejects reusing the current password', () => {
    expect(validatePasswordChange('current', 'current', 'current')).toBe('validation.passwordSame');
  });

  it('accepts a valid new password', () => {
    expect(validatePasswordChange('current', 'new-password', 'new-password')).toBeNull();
  });
});

describe('changePasswordHash', () => {
  it('rejects an incorrect current password without changing the stored hash', async () => {
    const storedHash = await hashPassword('current-password');

    await expect(changePasswordHash('wrong-password', 'new-password', 'new-password', storedHash)).rejects.toThrow(
      'current-password-incorrect',
    );
    await expect(verifyPassword('current-password', storedHash)).resolves.toBe(true);
  });

  it('creates a working hash for a valid password change', async () => {
    const storedHash = await hashPassword('current-password');
    const nextHash = await changePasswordHash('current-password', 'new-password', 'new-password', storedHash);

    expect(nextHash).not.toBe(storedHash);
    await expect(verifyPassword('current-password', nextHash)).resolves.toBe(false);
    await expect(verifyPassword('new-password', nextHash)).resolves.toBe(true);
  });

  it('validates new password rules before creating a new hash', async () => {
    const storedHash = await hashPassword('current-password');

    await expect(changePasswordHash('current-password', 'short', 'short', storedHash)).rejects.toThrow(
      'validation.passwordShort',
    );
    await expect(changePasswordHash('current-password', 'new-password', 'different', storedHash)).rejects.toThrow(
      'validation.passwordMismatch',
    );
    await expect(changePasswordHash('current-password', 'current-password', 'current-password', storedHash)).rejects.toThrow(
      'validation.passwordSame',
    );
  });
});
