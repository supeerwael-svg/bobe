const SESSION_KEY = 'school-admin.session';

export function readSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function writeSessionUserId(userId: string): void {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSessionUserId(): void {
  localStorage.removeItem(SESSION_KEY);
}
