import { describe, expect, it } from 'vitest';
import {
  canteenReport,
  classMonthlyHours,
  isEnrolledOn,
  monthlyAbsenceRates,
  monthlyMovements,
  schoolDaysInMonth,
  teacherDayAbsences,
} from '@/utils/absenceReports';
import { summarizeStudentAbsences } from '@/utils/absences';
import type { LessonSlot } from '@/utils/absences';

const WORKING_DAYS = [0, 1, 2, 3, 4];
const NO_HOLIDAYS = new Set<string>();
const FEB_2026_HOLIDAY = new Set(['2026-02-03']);

describe('schoolDaysInMonth', () => {
  it('counts only working days and skips holidays', () => {
    const days = schoolDaysInMonth('2026-02', WORKING_DAYS, NO_HOLIDAYS);
    expect(days).toHaveLength(20);
    expect(days).not.toContain('2026-02-07');
    expect(schoolDaysInMonth('2026-02', WORKING_DAYS, FEB_2026_HOLIDAY)).toHaveLength(19);
    expect(schoolDaysInMonth('2026-02', WORKING_DAYS, FEB_2026_HOLIDAY)).not.toContain('2026-02-03');
  });
});

describe('isEnrolledOn', () => {
  it('treats the leave date as the first day outside the school', () => {
    const student = { joinDate: '2026-02-10', leaveDate: '2026-02-20' };
    expect(isEnrolledOn(student, '2026-02-09')).toBe(false);
    expect(isEnrolledOn(student, '2026-02-10')).toBe(true);
    expect(isEnrolledOn(student, '2026-02-19')).toBe(true);
    expect(isEnrolledOn(student, '2026-02-20')).toBe(false);
  });

  it('treats missing dates as open-ended', () => {
    expect(isEnrolledOn({ joinDate: null, leaveDate: null }, '2000-01-01')).toBe(true);
  });
});

describe('canteenReport', () => {
  const students = [
    { id: 'a', classId: 'c1', boardingStatus: 'half-boarder' as const, joinDate: null, leaveDate: null },
    { id: 'b', classId: 'c1', boardingStatus: 'half-boarder' as const, joinDate: null, leaveDate: null },
    { id: 'x', classId: 'c1', boardingStatus: 'external' as const, joinDate: null, leaveDate: null },
  ];
  const records = [
    { studentId: 'a', classId: 'c1', date: '2026-02-04', justified: true },
    { studentId: 'a', classId: 'c1', date: '2026-02-04', justified: false },
    { studentId: 'a', classId: 'c1', date: '2026-02-04', justified: true },
    { studentId: 'a', classId: 'c1', date: '2026-02-04', justified: true },
    { studentId: 'b', classId: 'c1', date: '2026-02-04', justified: true },
    { studentId: 'x', classId: 'c1', date: '2026-02-04', justified: true },
  ];

  it('counts half-boarders absent for every lesson and subtracts them from the canteen', () => {
    const report = canteenReport({
      students,
      date: '2026-02-04',
      totalsByStudent: summarizeStudentAbsences(records, '2026-02-04'),
      lessonCountByClass: new Map([['c1', 4]]),
    });
    expect(report.halfBoarderCount).toBe(2);
    expect(report.absentHalfBoarderIds).toEqual(['a']);
    expect(report.expectedCount).toBe(1);
  });

  it('does not count absences when the class has no lessons that day', () => {
    const report = canteenReport({
      students,
      date: '2026-02-04',
      totalsByStudent: summarizeStudentAbsences(records, '2026-02-04'),
      lessonCountByClass: new Map(),
    });
    expect(report.absentHalfBoarderIds).toEqual([]);
    expect(report.expectedCount).toBe(2);
  });
});

describe('teacherDayAbsences', () => {
  it('lists only the records for the chosen date with hours and affected classes', () => {
    const rows = teacherDayAbsences(
      [
        {
          teacherId: 't1',
          date: '2026-02-04',
          lessons: [
            { period: 1, classId: 'c2', subject: 'Math' },
            { period: 3, classId: 'c1', subject: 'Math' },
          ],
        },
        { teacherId: 't2', date: '2026-02-05', lessons: [{ period: 2, classId: 'c1', subject: 'Arabic' }] },
      ],
      '2026-02-04',
    );
    expect(rows).toEqual([
      { teacherId: 't1', hours: 2, classIds: ['c1', 'c2'], lessons: expect.any(Array) },
    ]);
  });
});

function makeSlots(classId: string, periodsPerDay: number, days: number[]): LessonSlot[] {
  const slots: LessonSlot[] = [];
  for (const day of days) {
    for (let period = 1; period <= periodsPerDay; period += 1) {
      slots.push({ classId, day, period, subject: 'Math', teacherId: null });
    }
  }
  return slots;
}

describe('classMonthlyHours', () => {
  it('sums filled periods across school days, excluding holidays', () => {
    const schoolDays = schoolDaysInMonth('2026-02', [1, 2, 3, 4, 5], NO_HOLIDAYS);
    const slots = makeSlots('c1', 7, [1, 2, 3, 4, 5]);
    const hours = classMonthlyHours(slots, 'c1', schoolDays);
    expect(hours).toBe(schoolDays.length * 7);
  });

  it('returns 0 when the class has no timetable', () => {
    const schoolDays = schoolDaysInMonth('2026-02', WORKING_DAYS, NO_HOLIDAYS);
    expect(classMonthlyHours([], 'c1', schoolDays)).toBe(0);
  });
});

describe('monthlyAbsenceRates', () => {
  const schoolDays = schoolDaysInMonth('2026-02', WORKING_DAYS, FEB_2026_HOLIDAY);
  const slots = makeSlots('c1', 7, WORKING_DAYS);

  it('computes required hours = studentCount × classHours and rate rounded to 2 decimals', () => {
    const result = monthlyAbsenceRates({
      classIds: ['c1'],
      students: [
        { classId: 'c1', joinDate: null, leaveDate: null },
        { classId: 'c1', joinDate: null, leaveDate: null },
      ],
      studentAbsences: [
        { classId: 'c1', date: '2026-02-04', justified: true },
        { classId: 'c1', date: '2026-02-05', justified: false },
      ],
      schoolDays,
      slots,
    });
    const row = result.rows[0];
    expect(row.studentCount).toBe(2);
    expect(row.classHours).toBe(19 * 7);
    expect(row.requiredHours).toBe(2 * 19 * 7);
    expect(row.hours).toBe(2);
    expect(row.justifiedHours).toBe(1);
    expect(row.unjustifiedHours).toBe(1);
    const expectedRate = Math.round(((2 * 100) / (2 * 19 * 7)) * 100) / 100;
    expect(row.rate).toBe(expectedRate);
    expect(result.total.rate).toBe(expectedRate);
  });

  it('required hours = 28 weekly periods × 4 working weeks × 30 students = 3360', () => {
    const fourWeekDays = schoolDaysInMonth('2026-02', [1, 2, 3, 4, 5], NO_HOLIDAYS);
    expect(fourWeekDays.length).toBe(20);
    const slots: LessonSlot[] = [
      ...makeSlots('c1', 7, [1]),
      ...makeSlots('c1', 7, [2]),
      ...makeSlots('c1', 7, [3]),
      ...makeSlots('c1', 7, [4]),
    ];
    expect(slots.length).toBe(28);
    const thirtyStudents = Array.from({ length: 30 }, () => ({ classId: 'c1', joinDate: null, leaveDate: null }));
    const result = monthlyAbsenceRates({
      classIds: ['c1'],
      students: thirtyStudents,
      studentAbsences: [],
      schoolDays: fourWeekDays,
      slots,
    });
    const row = result.rows[0];
    expect(row.classHours).toBe(112);
    expect(row.studentCount).toBe(30);
    expect(row.requiredHours).toBe(3360);
    expect(row.hours).toBe(0);
    expect(row.rate).toBe(0);
  });

  it('returns null rate when class has no timetable', () => {
    const result = monthlyAbsenceRates({
      classIds: ['c1'],
      students: [{ classId: 'c1', joinDate: null, leaveDate: null }],
      studentAbsences: [],
      schoolDays,
      slots: [],
    });
    expect(result.rows[0].hasTimetable).toBe(false);
    expect(result.rows[0].requiredHours).toBe(0);
    expect(result.rows[0].rate).toBeNull();
  });

  it('returns null rate when class has no students', () => {
    const result = monthlyAbsenceRates({
      classIds: ['c1'],
      students: [],
      studentAbsences: [],
      schoolDays,
      slots,
    });
    expect(result.rows[0].studentCount).toBe(0);
    expect(result.rows[0].requiredHours).toBe(0);
    expect(result.rows[0].rate).toBeNull();
    expect(result.total.rate).toBeNull();
  });

  it('computes institution total from summed required hours', () => {
    const slots2 = makeSlots('c2', 7, WORKING_DAYS);
    const result = monthlyAbsenceRates({
      classIds: ['c1', 'c2'],
      students: [
        { classId: 'c1', joinDate: null, leaveDate: null },
        { classId: 'c2', joinDate: null, leaveDate: null },
      ],
      studentAbsences: [
        { classId: 'c1', date: '2026-02-04', justified: true },
        { classId: 'c2', date: '2026-02-05', justified: false },
      ],
      schoolDays,
      slots: [...slots, ...slots2],
    });
    const totalRequired = result.rows[0].requiredHours + result.rows[1].requiredHours;
    expect(result.total.requiredHours).toBe(totalRequired);
    const expectedTotalRate = Math.round(((2 * 100) / totalRequired) * 100) / 100;
    expect(result.total.rate).toBe(expectedTotalRate);
  });
});

describe('monthlyMovements', () => {
  it('lists students who joined or left during the month', () => {
    const students = [
      { id: 'a', joinDate: '2026-02-10', leaveDate: null },
      { id: 'b', joinDate: null, leaveDate: '2026-02-25' },
      { id: 'c', joinDate: '2026-01-05', leaveDate: '2026-03-01' },
    ];
    const movements = monthlyMovements(students, '2026-02');
    expect(movements.joined.map((student) => student.id)).toEqual(['a']);
    expect(movements.left.map((student) => student.id)).toEqual(['b']);
  });
});
