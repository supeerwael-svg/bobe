import type { SchoolClass } from '@/db/types';

export const CLASS_LEVELS = [1, 2, 3, 4] as const;

export function guessClassLevel(name: string): number | null {
  const match = /^\s*(\d)/.exec(name);
  if (!match) return null;
  const level = Number(match[1]);
  return (CLASS_LEVELS as readonly number[]).includes(level) ? level : null;
}

export function classLevelOf(schoolClass: Pick<SchoolClass, 'name' | 'level'>): number | null {
  return schoolClass.level !== undefined ? schoolClass.level : guessClassLevel(schoolClass.name);
}
