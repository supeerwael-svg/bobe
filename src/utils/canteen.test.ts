import { describe, expect, it } from 'vitest';
import type { CanteenEntry, Student } from '../db/types';
import { computeCanteenCounters, decideScan, findStudentByCode } from './canteen';

const DATE = '2026-11-06';

function student(overrides: Partial<Student> & { id: string }): Student {
  return {
    institutionId: 'inst',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    updatedBy: null,
    firstName: 'A',
    lastName: 'B',
    gender: 'male',
    dateOfBirth: null,
    placeOfBirth: '',
    repeater: false,
    boardingStatus: 'half-boarder',
    classId: 'c1',
    joinDate: null,
    leaveDate: null,
    cardCode: null,
    ...overrides,
  };
}

function entry(overrides: Partial<CanteenEntry>): CanteenEntry {
  return {
    id: Math.random().toString(36),
    institutionId: 'inst',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    updatedBy: null,
    studentId: 's1',
    scannedCode: 'x',
    date: DATE,
    time: '12:00',
    result: 'accepted',
    reason: null,
    manual: false,
    supervisorId: null,
    ...overrides,
  };
}

describe('findStudentByCode', () => {
  const students = [
    student({ id: 's1', cardCode: '  12345 ' }),
    student({ id: 's2', cardCode: null }),
  ];

  it('matches the trimmed scan against the card code', () => {
    expect(findStudentByCode(students, ' 12345\n', 'cardCode')?.id).toBe('s1');
  });

  it('matches by student id when configured', () => {
    expect(findStudentByCode(students, 's2', 'studentId')?.id).toBe('s2');
    expect(findStudentByCode(students, '12345', 'studentId')).toBeNull();
  });

  it('returns null for empty input or missing codes', () => {
    expect(findStudentByCode(students, '   ', 'cardCode')).toBeNull();
    expect(findStudentByCode(students, 'nope', 'cardCode')).toBeNull();
  });
});

describe('decideScan', () => {
  const halfBoarder = student({ id: 's1' });

  it('accepts a half-boarder on first entry', () => {
    const decision = decideScan({
      student: halfBoarder,
      date: DATE,
      todayEntries: [],
      absentToday: false,
      confirmedAbsent: false,
    });
    expect(decision.kind).toBe('accepted');
  });

  it('rejects a second entry the same day with the first time', () => {
    const decision = decideScan({
      student: halfBoarder,
      date: DATE,
      todayEntries: [entry({ time: '11:30' }), entry({ time: '12:45' })],
      absentToday: false,
      confirmedAbsent: false,
    });
    expect(decision).toEqual({
      kind: 'rejected',
      reason: 'duplicate',
      student: halfBoarder,
      firstEntryTime: '11:30',
    });
  });

  it('ignores voided entries when checking duplicates', () => {
    const decision = decideScan({
      student: halfBoarder,
      date: DATE,
      todayEntries: [entry({ deletedAt: '2026-11-06T10:00:00Z' })],
      absentToday: false,
      confirmedAbsent: false,
    });
    expect(decision.kind).toBe('accepted');
  });

  it('rejects unknown codes', () => {
    expect(
      decideScan({ student: null, date: DATE, todayEntries: [], absentToday: false, confirmedAbsent: false }),
    ).toEqual({ kind: 'rejected', reason: 'unknown', student: null, firstEntryTime: null });
  });

  it('rejects external students', () => {
    const decision = decideScan({
      student: student({ id: 's1', boardingStatus: 'external' }),
      date: DATE,
      todayEntries: [],
      absentToday: false,
      confirmedAbsent: false,
    });
    expect(decision).toMatchObject({ kind: 'rejected', reason: 'external' });
  });

  it('rejects students who left before today but not on or after today', () => {
    const left = decideScan({
      student: student({ id: 's1', leaveDate: '2026-11-05' }),
      date: DATE,
      todayEntries: [],
      absentToday: false,
      confirmedAbsent: false,
    });
    expect(left).toMatchObject({ kind: 'rejected', reason: 'left' });
    const leavingToday = decideScan({
      student: student({ id: 's1', leaveDate: DATE }),
      date: DATE,
      todayEntries: [],
      absentToday: false,
      confirmedAbsent: false,
    });
    expect(leavingToday.kind).toBe('accepted');
  });

  it('asks for confirmation when recorded absent today, then accepts once confirmed', () => {
    const base = { student: halfBoarder, date: DATE, todayEntries: [], absentToday: true };
    expect(decideScan({ ...base, confirmedAbsent: false }).kind).toBe('needsConfirmation');
    expect(decideScan({ ...base, confirmedAbsent: true }).kind).toBe('accepted');
  });
});

describe('computeCanteenCounters', () => {
  const students = [
    student({ id: 's1' }),
    student({ id: 's2' }),
    student({ id: 's3', leaveDate: '2026-11-01' }),
    student({ id: 's4', boardingStatus: 'external' }),
    student({ id: 's5', deletedAt: '2026-10-01T00:00:00Z' }),
  ];

  it('counts accepted, rejected, half-boarders and remaining', () => {
    const entries = [
      entry({ studentId: 's1' }),
      entry({ studentId: 's1', time: '12:30', result: 'rejected', reason: 'duplicate' }),
      entry({ studentId: null, result: 'rejected', reason: 'unknown' }),
      entry({ studentId: 's4', result: 'rejected', reason: 'external' }),
    ];
    expect(computeCanteenCounters(students, entries, DATE)).toEqual({
      accepted: 1,
      rejected: 3,
      halfBoarders: 2,
      remaining: 1,
    });
  });

  it('counts a student once even with several accepted entries', () => {
    const entries = [entry({ studentId: 's2' }), entry({ studentId: 's2', time: '13:00' })];
    expect(computeCanteenCounters(students, entries, DATE).accepted).toBe(1);
  });

  it('ignores voided entries and other days', () => {
    const entries = [
      entry({ studentId: 's1', deletedAt: '2026-11-06T09:00:00Z' }),
      entry({ studentId: 's2', date: '2026-11-05' }),
    ];
    expect(computeCanteenCounters(students, entries, DATE)).toEqual({
      accepted: 0,
      rejected: 0,
      halfBoarders: 2,
      remaining: 2,
    });
  });
});
