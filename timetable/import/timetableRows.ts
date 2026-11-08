import type { Room, Teacher, TimetableSlotInput } from '@/db/types';
import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';
import { normalizeName, parseDayLabel, parsePeriodLabel } from '@/utils/timetableParsing';

export const TIMETABLE_FIELDS = ['day', 'period', 'subject', 'teacher', 'room'] as const;
export type TimetableField = (typeof TIMETABLE_FIELDS)[number];
export type TimetableColumnMapping = Partial<Record<TimetableField, number>>;

export interface TimetableRowIssue {
  field: TimetableField | null;
  key: string;
}

export interface TimetablePreviewRow {
  rowNumber: number;
  label: string;
  input: TimetableSlotInput | null;
  issues: TimetableRowIssue[];
}

const EXTRA_ALIASES: Record<TimetableField, string[]> = {
  day: ['weekday', 'dayname'],
  period: ['hour', 'lesson', 'slot'],
  subject: ['course', 'matter'],
  teacher: ['teacher name'],
  room: ['classroom', 'room number'],
};

export function timetableHeaderAliases(field: TimetableField): string[] {
  return [en.timetable.fields[field], ar.timetable.fields[field], ...EXTRA_ALIASES[field]];
}

function normalizeHeader(value: string): string {
  return normalizeName(value).replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
}

export function detectTimetableMapping(headers: string[]): TimetableColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: TimetableColumnMapping = {};
  for (const field of TIMETABLE_FIELDS) {
    const aliases = timetableHeaderAliases(field).map(normalizeHeader);
    const index = normalized.findIndex((header, position) => !used.has(position) && header !== '' && aliases.includes(header));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

interface BuildTimetableRowsOptions {
  rows: unknown[][];
  mapping: TimetableColumnMapping;
  workingDays: number[];
  teachers: Teacher[];
  rooms: Room[];
  classId: string;
  dayLabel: (day: number) => string;
}

export function buildTimetableRows({
  rows,
  mapping,
  workingDays,
  teachers,
  rooms,
  classId,
  dayLabel,
}: BuildTimetableRowsOptions): TimetablePreviewRow[] {
  const teacherByName = new Map(teachers.map((teacher) => [normalizeName(teacher.name), teacher]));
  const roomByName = new Map(rooms.map((room) => [normalizeName(room.name), room]));
  const seenSlots = new Set<string>();

  return rows.flatMap((cells, index) => {
    const read = (field: TimetableField) => {
      const column = mapping[field];
      return column === undefined ? '' : cellText(cells[column]);
    };
    if (TIMETABLE_FIELDS.every((field) => read(field) === '')) return [];

    const issues: TimetableRowIssue[] = [];
    const addIssue = (field: TimetableField | null, key: string) => issues.push({ field, key });

    const dayText = read('day');
    const day = dayText === '' ? null : parseDayLabel(dayText);
    if (day === null) addIssue('day', dayText === '' ? 'validation.required' : 'validation.invalidDay');
    else if (!workingDays.includes(day)) addIssue('day', 'validation.dayNotWorking');

    const periodText = read('period');
    const period = periodText === '' ? null : parsePeriodLabel(periodText);
    if (period === null) addIssue('period', periodText === '' ? 'validation.required' : 'validation.invalidPeriod');

    const subject = read('subject').replace(/\s+/g, ' ');
    if (subject === '') addIssue('subject', 'validation.required');

    const teacherText = read('teacher');
    const teacher = teacherText === '' ? null : teacherByName.get(normalizeName(teacherText)) ?? null;
    if (teacherText !== '' && !teacher) addIssue('teacher', 'validation.teacherNotFound');

    const roomText = read('room');
    const room = roomText === '' ? null : roomByName.get(normalizeName(roomText)) ?? null;
    if (roomText !== '' && !room) addIssue('room', 'validation.roomNotFound');

    const rowNumber = index + 2;
    const slotKey = `${day}|${period}`;
    if (day !== null && period !== null) {
      if (seenSlots.has(slotKey)) addIssue(null, 'validation.duplicateSlotInFile');
      seenSlots.add(slotKey);
    }

    const label = day !== null && period !== null ? `${dayLabel(day)} · ${period}` : '';
    const input: TimetableSlotInput | null =
      issues.length === 0 && day !== null && period !== null
        ? { classId, day, period, subject, teacherId: teacher?.id ?? null, roomId: room?.id ?? null }
        : null;

    return [{ rowNumber, label, input, issues }];
  });
}
