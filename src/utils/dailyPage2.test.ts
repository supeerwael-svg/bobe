import { describe, expect, it } from 'vitest';
import type { CanteenEntry, SchoolClass, Student, StudentAbsence, Teacher, TeacherAbsence, TimetableSlot, User } from '@/db/types';
import { computePage2, periodColumns, type Page2Input } from '@/utils/dailyPage2';
import { weekdayOfDate } from '@/utils/absences';
import { formatRate } from '@/utils/dailyReportStats';

const DATE = '2026-11-02';
const base = { institutionId: 'inst', createdAt: '', updatedAt: '', deletedAt: null, updatedBy: null };

function student(id: string, gender: 'male' | 'female'): Student {
  return {
    ...base,
    id,
    firstName: id,
    lastName: 'X',
    gender,
    dateOfBirth: null,
    placeOfBirth: '',
    repeater: false,
    boardingStatus: 'external',
    classId: 'c1',
    joinDate: null,
    leaveDate: null,
  };
}

function slot(period: number): TimetableSlot {
  return { ...base, id: `slot${period}`, classId: 'c1', day: weekdayOfDate(DATE), period, subject: 'Math', teacherId: 't1', roomId: null };
}

function absence(studentId: string, period: number): StudentAbsence {
  return { ...base, id: `${studentId}-${period}`, classId: 'c1', studentId, date: DATE, period, subject: 'Math', justified: false };
}

function input(overrides: Partial<Page2Input>): Page2Input {
  return {
    date: DATE,
    rule: 'wholeDay',
    classes: [{ ...base, id: 'c1', name: '1م1', level: undefined }] as SchoolClass[],
    students: [student('s1', 'male'), student('s2', 'female')],
    slots: [slot(1), slot(2)],
    studentAbsences: [absence('s1', 1), absence('s1', 2), absence('s2', 1)],
    teachers: [{ ...base, id: 't1', name: 'Teacher', assignments: [] } as Teacher],
    teacherAbsences: [],
    supervisors: [],
    supervisorRows: [],
    teacherNotes: {},
    canteenEntries: [],
    ...overrides,
  };
}

describe('periodColumns', () => {
  it('uses seven columns by default and grows up to eight', () => {
    expect(periodColumns([])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(periodColumns([8])).toHaveLength(8);
    expect(periodColumns([9])).toHaveLength(8);
  });
});

describe('computePage2 student totals', () => {
  it('counts only whole-day absences under the whole-day rule', () => {
    const result = computePage2(input({}));
    const level1 = result.levels.find((item) => item.level === 1);
    expect(level1).toMatchObject({ enrolled: 2, absent: 1 });
    expect(level1?.rate).toBe(50);
    expect(formatRate(level1?.rate ?? null)).toBe('50.00%');
    expect(result.summary.students.all).toEqual({ total: 2, absent: 1, present: 1 });
    expect(result.summary.students.male).toEqual({ total: 1, absent: 1, present: 0 });
    expect(result.summary.students.female).toEqual({ total: 1, absent: 0, present: 1 });
  });

  it('counts any absent period under the at-least-one-period rule', () => {
    const result = computePage2(input({ rule: 'anyPeriod' }));
    expect(result.levels.find((item) => item.level === 1)).toMatchObject({ enrolled: 2, absent: 2, rate: 100 });
  });

  it('shows a dash when a level has no enrolled students', () => {
    const result = computePage2(input({}));
    const level4 = result.levels.find((item) => item.level === 4);
    expect(level4).toMatchObject({ enrolled: 0, absent: 0, rate: null });
    expect(formatRate(level4?.rate ?? null)).toBe('—');
  });
});

describe('computePage2 teachers, canteen and supervisors', () => {
  it('marks the lessons a teacher did not give and counts the absent teacher', () => {
    const teacherAbsence: TeacherAbsence = {
      ...base,
      id: 'ta1',
      teacherId: 't1',
      date: DATE,
      lessons: [{ period: 2, classId: 'c1', subject: 'Math' }],
    };
    const result = computePage2(input({ teacherAbsences: [teacherAbsence] }));
    expect(result.teacherLines).toHaveLength(1);
    expect(result.teacherLines[0]).toMatchObject({ name: 'Teacher', marks: [2], classes: '1م1' });
    expect(result.summary.teachers).toEqual({ total: 1, absent: 1, present: 0 });
  });

  it('counts a supervisor absent when either period is absent', () => {
    const supervisors = [
      { ...base, id: 'u1', name: 'A', role: 'supervisor', status: 'approved' },
      { ...base, id: 'u2', name: 'B', role: 'supervisor', status: 'approved' },
    ] as User[];
    const result = computePage2(
      input({
        supervisors,
        supervisorRows: [{ supervisorId: 'u1', name: 'A', morning: 'none', evening: 'absent', notes: '' }],
      }),
    );
    expect(result.summary.supervisors).toEqual({ total: 2, absent: 1, present: 1 });
  });

  it('lists absent half-boarders with their class', () => {
    const boarder = { ...student('s1', 'male'), boardingStatus: 'half-boarder' as const };
    const result = computePage2(input({ students: [boarder, student('s2', 'female')] }));
    expect(result.canteen).toEqual({
      halfBoarders: 1,
      present: 0,
      absent: 1,
      absentNames: ['s1 X (1م1)'],
      source: 'calculated',
    });
  });
});

describe('computePage2 canteen from scans', () => {
  const boarder = (id: string) => ({ ...student(id, 'male'), boardingStatus: 'half-boarder' as const });
  const scan = (studentId: string, result: 'accepted' | 'rejected'): CanteenEntry => ({
    ...base,
    id: `e-${studentId}-${result}`,
    studentId,
    scannedCode: 'code',
    date: DATE,
    time: '07:30',
    result,
    reason: result === 'rejected' ? 'duplicate' : null,
    manual: false,
    supervisorId: null,
  });
  const students = [boarder('b1'), boarder('b2'), student('s3', 'female')];

  it('uses accepted scans and lists half-boarders without one', () => {
    const result = computePage2(input({ students, studentAbsences: [], canteenEntries: [scan('b1', 'accepted')] }));
    expect(result.canteen).toEqual({
      halfBoarders: 2,
      present: 1,
      absent: 1,
      absentNames: ['b2 X (1م1)'],
      source: 'scans',
    });
  });

  it('treats a rejected scan as not entered', () => {
    const result = computePage2(
      input({ students, studentAbsences: [], canteenEntries: [scan('b1', 'accepted'), scan('b2', 'rejected')] }),
    );
    expect(result.canteen).toMatchObject({ present: 1, absent: 1, absentNames: ['b2 X (1م1)'], source: 'scans' });
  });

  it('ignores scans from other dates', () => {
    const otherDay = { ...scan('b1', 'accepted'), date: '2026-11-03' };
    const result = computePage2(input({ students, studentAbsences: [], canteenEntries: [otherDay] }));
    expect(result.canteen).toMatchObject({ halfBoarders: 2, absent: 2, source: 'calculated' });
  });
});
