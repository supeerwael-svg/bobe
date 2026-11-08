import { normalizeText } from '@/utils/text';
import { PERIODS } from '@/utils/schedule';

const COMBINING_AND_TATWEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g;

export function normalizeName(value: string): string {
  return normalizeText(value.normalize('NFKD').replace(COMBINING_AND_TATWEEL, '')).replace(/[\s\u00A0]+/g, ' ');
}

const DAY_SYNONYMS: Record<number, string[]> = {
  0: ['sunday', 'sun', 'dimanche', 'dim', 'الأحد'],
  1: ['monday', 'mon', 'lundi', 'lun', 'الاثنين', 'الإثنين'],
  2: ['tuesday', 'tue', 'mardi', 'mar', 'الثلاثاء'],
  3: ['wednesday', 'wed', 'mercredi', 'mer', 'الأربعاء'],
  4: ['thursday', 'thu', 'jeudi', 'jeu', 'الخميس'],
  5: ['friday', 'fri', 'vendredi', 'ven', 'الجمعة'],
  6: ['saturday', 'sat', 'samedi', 'sam', 'السبت'],
};

const DAY_BY_NAME = new Map<string, number>(
  Object.entries(DAY_SYNONYMS).flatMap(([day, names]) =>
    names.map((name): [string, number] => [normalizeName(name), Number(day)]),
  ),
);

export function parseDayLabel(text: string): number | null {
  return DAY_BY_NAME.get(normalizeName(text)) ?? null;
}

const TIME_PATTERN = /(\d{1,2})\s*[:h.]\s*(\d{2})/;
const NUMBER_PATTERN = /^\D*?(\d{1,2})\D*$/;

export function parsePeriodLabel(text: string): number | null {
  const trimmed = text.trim();
  const time = TIME_PATTERN.exec(trimmed);
  if (time) {
    const start = `${time[1].padStart(2, '0')}:${time[2]}`;
    return PERIODS.find((period) => period.start === start)?.number ?? null;
  }
  const match = NUMBER_PATTERN.exec(trimmed);
  if (!match) return null;
  const number = Number(match[1]);
  return PERIODS.some((period) => period.number === number) ? number : null;
}

export interface ParsedCell {
  subject: string;
  teacher: string;
  room: string;
  extraParts: number;
}

const CELL_SEPARATORS = /\r?\n|[-–—/|,()]/;

export function parseCellContent(text: string): ParsedCell {
  const parts = text
    .split(CELL_SEPARATORS)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part !== '');
  return {
    subject: parts[0] ?? '',
    teacher: parts[1] ?? '',
    room: parts[2] ?? '',
    extraParts: Math.max(0, parts.length - 3),
  };
}

export type DayAxis = 'columns' | 'rows';

export function detectDayAxis(grid: unknown[][]): DayAxis | null {
  let maxDaysInRow = 0;
  const daysInColumn = new Map<number, number>();
  for (const row of grid) {
    let daysInThisRow = 0;
    row.forEach((value, column) => {
      if (parseDayLabel(String(value ?? '')) === null) return;
      daysInThisRow += 1;
      daysInColumn.set(column, (daysInColumn.get(column) ?? 0) + 1);
    });
    maxDaysInRow = Math.max(maxDaysInRow, daysInThisRow);
  }
  const maxDaysInColumn = Math.max(0, ...daysInColumn.values());
  if (maxDaysInRow === 0 && maxDaysInColumn === 0) return null;
  return maxDaysInRow >= maxDaysInColumn ? 'columns' : 'rows';
}
