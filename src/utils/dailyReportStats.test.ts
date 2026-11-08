import { describe, expect, it } from 'vitest';
import { absenceRate, absenceStreakStart, formatRate, levelAttendance, studentSummary, type AttendanceInput } from './dailyReportStats';
import { guessClassLevel, classLevelOf } from './classLevel';
import { schoolYearForDate } from './schoolYear';

const base: AttendanceInput = {
  date: '2026-11-08',
  rule: 'wholeDay',
  classes: [
    { id: 'c1', name: '1م1' },
    { id: 'c2', name: '1م2' },
    { id: 'c3', name: '2ع1', level: 3 },
    { id: 'c4', name: 'Admin' },
  ],
  students: [
    { id: 's1', classId: 'c1', gender: 'male', joinDate: null, leaveDate: null },
    { id: 's2', classId: 'c1', gender: 'female', joinDate: null, leaveDate: null },
    { id: 's3', classId: 'c2', gender: 'male', joinDate: null, leaveDate: '2026-11-01' },
    { id: 's4', classId: 'c2', gender: 'female', joinDate: null, leaveDate: null },
    { id: 's5', classId: 'c3', gender: 'male', joinDate: '2026-11-10', leaveDate: null },
  ],
  totalsByStudent: new Map([
    ['s1', { hours: 4, justifiedHours: 0, unjustifiedHours: 4 }],
    ['s2', { hours: 1, justifiedHours: 1, unjustifiedHours: 0 }],
  ]),
  lessonCountByClass: new Map([
    ['c1', 4],
    ['c2', 4],
    ['c3', 4],
  ]),
};

describe('absenceRate', () => {
  it('rounds to two decimals and returns null without students', () => {
    expect(absenceRate(1, 3)).toBe(33.33);
    expect(absenceRate(0, 0)).toBeNull();
    expect(formatRate(null)).toBe('—');
    expect(formatRate(33.333)).toBe('33.33%');
  });
});

describe('levelAttendance', () => {
  it('sums enrolled and absent students per level', () => {
    const levels = levelAttendance(base);
    const level1 = levels.find((item) => item.level === 1);
    expect(level1?.enrolled).toBe(3);
    expect(level1?.absent).toBe(1);
    expect(level1?.rate).toBe(33.33);
    expect(level1?.classes.map((item) => item.className)).toEqual(['1م1', '1م2']);
  });

  it('counts a partially absent student only in anyPeriod mode', () => {
    const anyPeriod = levelAttendance({ ...base, rule: 'anyPeriod' });
    expect(anyPeriod.find((item) => item.level === 1)?.absent).toBe(2);
  });

  it('returns empty levels with a null rate', () => {
    const level2 = levelAttendance(base).find((item) => item.level === 2);
    expect(level2).toEqual({ level: 2, classes: [], enrolled: 0, absent: 0, rate: null });
  });

  it('excludes students not yet enrolled on the date', () => {
    const level3 = levelAttendance(base).find((item) => item.level === 3);
    expect(level3?.enrolled).toBe(0);
  });
});

describe('studentSummary', () => {
  it('splits enrolled and absent students by gender', () => {
    const summary = studentSummary(base);
    expect(summary.male).toEqual({ total: 1, absent: 1, present: 0 });
    expect(summary.female).toEqual({ total: 2, absent: 0, present: 2 });
    expect(summary.all).toEqual({ total: 3, absent: 1, present: 2 });
  });
});

describe('absenceStreakStart', () => {
  const schoolDays = new Set(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  const absentDays = new Set(['2026-11-03', '2026-11-04', '2026-11-05']);

  it('walks back over absent school days and skips non-school days', () => {
    const start = absenceStreakStart(
      '2026-11-05',
      (day) => absentDays.has(day),
      (day) => schoolDays.has(day),
    );
    expect(start).toBe('2026-11-03');
  });

  it('returns the date itself when there is no previous absence', () => {
    expect(absenceStreakStart('2026-11-05', () => false, () => true)).toBe('2026-11-05');
  });
});

describe('class level and school year', () => {
  it('guesses the level from the first digit of the class name', () => {
    expect(guessClassLevel('1م1')).toBe(1);
    expect(guessClassLevel('4ت2')).toBe(4);
    expect(guessClassLevel('5م1')).toBeNull();
    expect(guessClassLevel('Admin')).toBeNull();
  });

  it('prefers an explicit level over the guess', () => {
    expect(classLevelOf({ name: '1م1', level: 2 })).toBe(2);
    expect(classLevelOf({ name: '1م1', level: null })).toBeNull();
    expect(classLevelOf({ name: '1م1' })).toBe(1);
  });

  it('derives the school year from a September to June calendar', () => {
    expect(schoolYearForDate('2026-11-06')).toBe('2026/2027');
    expect(schoolYearForDate('2027-03-01')).toBe('2026/2027');
    expect(schoolYearForDate('2027-09-01')).toBe('2027/2028');
  });
});
