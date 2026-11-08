import { describe, expect, it } from 'vitest';
import {
  affectedClassIds,
  classLessonsForDay,
  isIsoDate,
  summarizeStudentAbsences,
  teacherAbsenceHours,
  teacherLessonsForDay,
  weekdayOfDate,
  type LessonSlot,
} from '@/utils/absences';

const SLOTS: LessonSlot[] = [
  { classId: 'c1', day: 0, period: 1, subject: 'Math', teacherId: 't1' },
  { classId: 'c1', day: 0, period: 2, subject: 'Arabic', teacherId: 't2' },
  { classId: 'c1', day: 0, period: 5, subject: 'Science', teacherId: 't1' },
  { classId: 'c2', day: 0, period: 1, subject: 'Math', teacherId: 't1' },
  { classId: 'c2', day: 1, period: 1, subject: 'Math', teacherId: 't1' },
  { classId: 'c2', day: 0, period: 3, subject: 'Sport', teacherId: null },
];

describe('isIsoDate and weekdayOfDate', () => {
  it('accepts only real calendar dates', () => {
    expect(isIsoDate('2026-11-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('01/11/2026')).toBe(false);
  });

  it('uses the same day numbering as the timetable (0 = Sunday)', () => {
    expect(weekdayOfDate('2026-11-01')).toBe(0);
    expect(weekdayOfDate('2026-11-02')).toBe(1);
    expect(weekdayOfDate('2026-11-07')).toBe(6);
  });
});

describe('classLessonsForDay', () => {
  it('returns only the class lessons for that weekday, ordered by period', () => {
    expect(classLessonsForDay(SLOTS, 'c1', 0)).toEqual([
      { period: 1, subject: 'Math', teacherId: 't1' },
      { period: 2, subject: 'Arabic', teacherId: 't2' },
      { period: 5, subject: 'Science', teacherId: 't1' },
    ]);
  });

  it('returns an empty list for a free day', () => {
    expect(classLessonsForDay(SLOTS, 'c1', 3)).toEqual([]);
  });
});

describe('teacher absences', () => {
  it('lists one lesson per period for a teacher on the weekday', () => {
    const lessons = teacherLessonsForDay(SLOTS, 't1', 0);
    expect(lessons).toEqual([
      { period: 1, classId: 'c1', subject: 'Math' },
      { period: 5, classId: 'c1', subject: 'Science' },
    ]);
    expect(teacherAbsenceHours(lessons)).toBe(2);
  });

  it('suggests each affected class once', () => {
    const lessons = [
      { period: 1, classId: 'c1', subject: 'Math' },
      { period: 2, classId: 'c2', subject: 'Math' },
      { period: 3, classId: 'c1', subject: 'Science' },
    ];
    expect(affectedClassIds(lessons)).toEqual(['c1', 'c2']);
  });

  it('ignores lessons without a teacher', () => {
    expect(teacherLessonsForDay(SLOTS, 'missing', 0)).toEqual([]);
  });
});

describe('summarizeStudentAbsences', () => {
  const records = [
    { studentId: 's1', date: '2026-11-01', justified: true },
    { studentId: 's1', date: '2026-11-01', justified: false },
    { studentId: 's1', date: '2026-11-02', justified: false },
    { studentId: 's2', date: '2026-11-01', justified: true },
  ];

  it('totals hours and justified split across all dates', () => {
    const totals = summarizeStudentAbsences(records);
    expect(totals.get('s1')).toEqual({ hours: 3, justifiedHours: 1, unjustifiedHours: 2 });
    expect(totals.get('s2')).toEqual({ hours: 1, justifiedHours: 1, unjustifiedHours: 0 });
  });

  it('restricts totals to one day when a date is given', () => {
    const totals = summarizeStudentAbsences(records, '2026-11-01');
    expect(totals.get('s1')).toEqual({ hours: 2, justifiedHours: 1, unjustifiedHours: 1 });
    expect(totals.size).toBe(2);
  });

  it('returns an empty map when there are no records', () => {
    expect(summarizeStudentAbsences([]).size).toBe(0);
  });
});
