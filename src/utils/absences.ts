import type { StudentAbsence, TeacherAbsenceLesson, TimetableSlot } from '@/db/types';
import { slotLessons } from '@/utils/timetableLessons';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function weekdayOfDate(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export type LessonSlot = Pick<TimetableSlot, 'classId' | 'day' | 'period' | 'subject' | 'teacherId'> &
  Partial<Pick<TimetableSlot, 'roomId' | 'groups'>>;

export interface ClassLesson {
  period: number;
  subject: string;
  teacherId: string | null;
}

export function classLessonsForDay(slots: LessonSlot[], classId: string, day: number): ClassLesson[] {
  return slots
    .filter((slot) => slot.classId === classId && slot.day === day)
    .sort((a, b) => a.period - b.period)
    .map((slot) => {
      const lessons = slotLessons(slot);
      const subjects = [...new Set(lessons.map((lesson) => lesson.subject))];
      return {
        period: slot.period,
        subject: subjects.join(' / '),
        teacherId: lessons.length === 1 ? lessons[0].teacherId : null,
      };
    });
}

export function teacherLessonsForDay(slots: LessonSlot[], teacherId: string, day: number): TeacherAbsenceLesson[] {
  const byPeriod = new Map<number, TeacherAbsenceLesson>();
  for (const slot of [...slots].sort((a, b) => a.period - b.period)) {
    if (slot.day !== day || byPeriod.has(slot.period)) continue;
    const lesson = slotLessons(slot).find((item) => item.teacherId === teacherId);
    if (lesson) byPeriod.set(slot.period, { period: slot.period, classId: slot.classId, subject: lesson.subject });
  }
  return [...byPeriod.values()];
}

export function affectedClassIds(lessons: TeacherAbsenceLesson[]): string[] {
  return [...new Set(lessons.map((lesson) => lesson.classId))].sort();
}

export function teacherAbsenceHours(lessons: TeacherAbsenceLesson[]): number {
  return lessons.length;
}

export interface StudentAbsenceTotals {
  hours: number;
  justifiedHours: number;
  unjustifiedHours: number;
}

export function summarizeStudentAbsences(
  records: Pick<StudentAbsence, 'studentId' | 'justified' | 'date'>[],
  date?: string,
): Map<string, StudentAbsenceTotals> {
  const totals = new Map<string, StudentAbsenceTotals>();
  for (const record of records) {
    if (date !== undefined && record.date !== date) continue;
    const current = totals.get(record.studentId) ?? { hours: 0, justifiedHours: 0, unjustifiedHours: 0 };
    current.hours += 1;
    if (record.justified) current.justifiedHours += 1;
    else current.unjustifiedHours += 1;
    totals.set(record.studentId, current);
  }
  return totals;
}
