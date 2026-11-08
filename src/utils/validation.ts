export const MIN_PASSWORD_LENGTH = 6;

export function requiredKey(value: string): string | null {
  return value.trim() ? null : 'validation.required';
}

export function passwordKey(value: string): string | null {
  if (!value) return 'validation.required';
  return value.length >= MIN_PASSWORD_LENGTH ? null : 'validation.passwordShort';
}

export function maxLengthKey(value: string, max: number, key: string): string | null {
  return value.length <= max ? null : key;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
