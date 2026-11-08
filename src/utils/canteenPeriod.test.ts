import { describe, expect, it } from 'vitest';
import type { CanteenEntry, SchoolClass, Student } from '../db/types';
import {
  buildMonthlyClassRows,
  buildPeriodRows,
  entryKey,
  halfBoardersWithoutEntry,
  isZeroEntry,
  periodDates,
  rejectedEntries,
  sortByLowestRate,
  splitMissedDays,
} from './canteenPeriod';

const NO_HOLIDAYS = new Set<string>();
const CONTEXT = { canteenDays: [0, 1, 2, 3, 4], holidayDates: NO_HOLIDAYS };

function student(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    institutionId: 'inst',
    firstName: id,
    lastName: 'Test',
    gender: 'male',
    dateOfBirth: null,
    placeOfBirth: '',
    repeater: false,
    boardingStatus: 'half-boarder',
    classId: 'c1',
    joinDate: null,
    leaveDate: null,
    cardCode: null,
    deletedAt: null,
    ...overrides,
  } as Student;
}

function accepted(studentId: string, date: string): CanteenEntry {
  return {
    id: `${studentId}-${date}`,
    institutionId: 'inst',
    studentId,
    scannedCode: 'x',
    date,
    time: '12:00',
    result: 'accepted',
    reason: null,
    manual: false,
    supervisorId: 'u',
    deletedAt: null,
  } as CanteenEntry;
}

// 2026-11-02 is a Monday, 2026-11-08 is a Sunday
const WEEK = periodDates('week', '2026-11-04');

describe('periodDates', () => {
  it('returns Sunday to Saturday for week mode', () => {
    expect(WEEK[0]).toBe('2026-11-01');
    expect(WEEK[6]).toBe('2026-11-07');
  });

  it('returns every day of the month', () => {
    expect(periodDates('month', '2026-02-10')).toHaveLength(28);
  });
});

describe('buildPeriodRows', () => {
  it('counts only canteen days the student was enrolled on', () => {
    const late = student('late', { joinDate: '2026-11-04' });
    const [row] = buildPeriodRows([late], WEEK, [], CONTEXT).filter((r) => r.studentId === 'late');
    expect(row.expectedDays).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('skips weekdays the canteen is closed and holidays', () => {
    const rows = buildPeriodRows(
      [student('a')],
      WEEK,
      [],
      { canteenDays: [0, 1, 2, 3, 4], holidayDates: new Set(['2026-11-02']) },
    );
    expect(rows[0].expectedDays).not.toContain('2026-11-02');
    expect(rows[0].expectedDays).not.toContain('2026-11-07');
    expect(rows[0].expectedDays).toHaveLength(4);
  });

  it('computes entered, missed and rate', () => {
    const [row] = buildPeriodRows(
      [student('a')],
      ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'],
      [accepted('a', '2026-11-01'), accepted('a', '2026-11-03')],
      CONTEXT,
    );
    expect(row.enteredDays).toEqual(['2026-11-01', '2026-11-03']);
    expect(row.missedDays).toEqual(['2026-11-02', '2026-11-04']);
    expect(row.rate).toBe(50);
  });

  it('ignores external students and deleted records', () => {
    const rows = buildPeriodRows(
      [student('ext', { boardingStatus: 'external' }), student('gone', { deletedAt: '2026-01-01' })],
      WEEK,
      [],
      CONTEXT,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('zero-entry detection and ordering', () => {
  it('flags students with expected days and no entries', () => {
    const rows = buildPeriodRows([student('a'), student('b')], WEEK, [accepted('a', '2026-11-02')], CONTEXT);
    const zero = rows.filter(isZeroEntry).map((row) => row.studentId);
    expect(zero).toEqual(['b']);
  });

  it('sorts lowest rate first and puts rate-less rows last', () => {
    const rows = sortByLowestRate([
      { studentId: 'hi', expectedDays: ['d'], enteredDays: ['d'], missedDays: [], rate: 100 },
      { studentId: 'none', expectedDays: [], enteredDays: [], missedDays: [], rate: null },
      { studentId: 'lo', expectedDays: ['d', 'e'], enteredDays: [], missedDays: ['d', 'e'], rate: 0 },
    ]);
    expect(rows.map((row) => row.studentId)).toEqual(['lo', 'hi', 'none']);
  });
});

describe('splitMissedDays', () => {
  it('separates whole-day school absence from present-but-did-not-eat', () => {
    const [row] = buildPeriodRows(
      [student('a')],
      ['2026-11-02', '2026-11-03'],
      [],
      CONTEXT,
    );
    const absentKeys = new Set([entryKey('a', '2026-11-02')]);
    expect(splitMissedDays(row, absentKeys)).toEqual({
      absentFromSchool: ['2026-11-02'],
      presentNotEaten: ['2026-11-03'],
    });
  });
});

describe('halfBoardersWithoutEntry', () => {
  it('lists enrolled half-boarders with no accepted entry on a canteen day', () => {
    const list = halfBoardersWithoutEntry(
      [student('a'), student('b')],
      '2026-11-02',
      [accepted('a', '2026-11-02')],
      CONTEXT,
    );
    expect(list.map((s) => s.id)).toEqual(['b']);
  });

  it('returns nothing on a closed day', () => {
    expect(halfBoardersWithoutEntry([student('a')], '2026-11-07', [], CONTEXT)).toEqual([]);
  });
});

describe('rejectedEntries', () => {
  const rejected = (reason: CanteenEntry['reason'], time: string): CanteenEntry => ({
    ...accepted('x', '2026-11-02'),
    id: `r-${time}`,
    result: 'rejected',
    reason,
    time,
  });

  it('filters by day and reason, latest first', () => {
    const entries = [rejected('duplicate', '08:00'), rejected('external', '09:00'), rejected('duplicate', '10:00')];
    expect(rejectedEntries(entries, '2026-11-02', 'duplicate').map((e) => e.time)).toEqual(['10:00', '08:00']);
    expect(rejectedEntries(entries, '2026-11-02', 'all')).toHaveLength(3);
    expect(rejectedEntries(entries, '2026-11-03', 'all')).toHaveLength(0);
  });
});

describe('buildMonthlyClassRows', () => {
  const NOVEMBER = periodDates('month', '2026-11-01');
  const cls = (id: string, name: string, level?: number): SchoolClass =>
    ({ id, institutionId: 'inst', name, level, createdAt: '', updatedAt: '', deletedAt: null, updatedBy: null } as SchoolClass);

  it('computes expected/actual/missed per class for the month', () => {
    const classes = [cls('c1', '1م1', 1), cls('c2', '2م1', 2)];
    const students = [
      student('a', { classId: 'c1' }),
      student('b', { classId: 'c1' }),
      student('c', { classId: 'c2' }),
    ];
    const entries = [accepted('a', '2026-11-02'), accepted('a', '2026-11-03'), accepted('c', '2026-11-02')];
    const rows = buildMonthlyClassRows(students, classes, NOVEMBER, entries, CONTEXT);
    const c1 = rows.find((r) => r.classId === 'c1');
    const c2 = rows.find((r) => r.classId === 'c2');
    expect(c1?.studentCount).toBe(2);
    expect(c1?.actualEntries).toBe(2);
    expect(c1?.missedEntries).toBe(c1!.expectedEntries - 2);
    expect(c2?.studentCount).toBe(1);
    expect(c2?.actualEntries).toBe(1);
  });

  it('skips classes with no half-boarders', () => {
    const classes = [cls('c1', '1م1', 1), cls('c2', '2م1', 2)];
    const students = [student('a', { classId: 'c1' })];
    const rows = buildMonthlyClassRows(students, classes, NOVEMBER, [], CONTEXT);
    expect(rows.map((r) => r.classId)).toEqual(['c1']);
  });

  it('calculates rate as null when no expected entries', () => {
    const classes = [cls('c1', '1م1', 1)];
    const students = [student('a', { classId: 'c1', joinDate: '2026-12-01' })];
    const rows = buildMonthlyClassRows(students, classes, NOVEMBER, [], CONTEXT);
    expect(rows[0].expectedEntries).toBe(0);
    expect(rows[0].rate).toBeNull();
  });

  it('sorts by level then class name', () => {
    const classes = [cls('c2', '2م1', 2), cls('c1', '1م2', 1), cls('c3', '1م1', 1)];
    const students = [student('a', { classId: 'c1' }), student('b', { classId: 'c2' }), student('c', { classId: 'c3' })];
    const rows = buildMonthlyClassRows(students, classes, NOVEMBER, [], CONTEXT);
    expect(rows.map((r) => r.className)).toEqual(['1م1', '1م2', '2م1']);
  });

  it('respects canteen days and holidays', () => {
    const classes = [cls('c1', '1م1', 1)];
    const students = [student('a', { classId: 'c1' })];
    const ctx = { canteenDays: [1, 2, 3, 4, 5], holidayDates: new Set(['2026-11-02']) };
    const rows = buildMonthlyClassRows(students, classes, NOVEMBER, [], ctx);
    const schoolDaysInNov = NOVEMBER.filter((d) => ctx.canteenDays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && !ctx.holidayDates.has(d));
    expect(rows[0].expectedEntries).toBe(schoolDaysInNov.length);
  });
});
