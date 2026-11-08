import type { AbsenceWorkspace } from '@/db/absences';
import type { Student } from '@/db/types';
import {
  canteenReport,
  isEnrolledOn,
  isSchoolDay,
  monthlyAbsenceRates,
  monthlyMovements,
  schoolDaysInMonth,
  teacherDayAbsences,
  type MonthlyClassRate,
  type MonthlyTotals,
} from '@/utils/absenceReports';
import { classLessonsForDay, summarizeStudentAbsences, weekdayOfDate, type StudentAbsenceTotals } from '@/utils/absences';

export interface MonthlyClassLine extends MonthlyClassRate {
  className: string;
}

export interface MovementLine {
  studentId: string;
  name: string;
  className: string;
  date: string;
}

export interface MonthlyReport {
  month: string;
  schoolDayCount: number;
  rows: MonthlyClassLine[];
  total: MonthlyTotals;
  joined: MovementLine[];
  left: MovementLine[];
}

function fullName(student: { firstName: string; lastName: string }): string {
  return `${student.firstName} ${student.lastName}`;
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

export function buildMonthlyReport(data: AbsenceWorkspace, month: string): MonthlyReport {
  const schoolDays = schoolDaysInMonth(month, data.workingDays, new Set(data.holidayDates));
  const classNameById = new Map(data.classes.map((item) => [item.id, item.name]));
  const { rows, total } = monthlyAbsenceRates({
    classIds: data.classes.map((item) => item.id),
    students: data.students,
    studentAbsences: data.studentAbsences,
    schoolDays,
    slots: data.slots,
  });
  const movements = monthlyMovements(data.students, month);
  const toLine = (student: Student, date: string): MovementLine => ({
    studentId: student.id,
    name: fullName(student),
    className: classNameById.get(student.classId) ?? '',
    date,
  });

  return {
    month,
    schoolDayCount: schoolDays.length,
    rows: rows.map((row) => ({ ...row, className: classNameById.get(row.classId) ?? '' })),
    total,
    joined: movements.joined.map((student) => toLine(student, student.joinDate ?? '')).sort(byName),
    left: movements.left.map((student) => toLine(student, student.leaveDate ?? '')).sort(byName),
  };
}
