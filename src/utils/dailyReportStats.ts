import type { AbsenceCountRule, SchoolClass, Student } from '@/db/types';
import type { StudentAbsenceTotals } from '@/utils/absences';
import { isAbsentAllDay, isEnrolledOn } from '@/utils/absenceReports';
import { classLevelOf, CLASS_LEVELS } from '@/utils/classLevel';

const MAX_STREAK_LOOKBACK_DAYS = 366;

export function shiftIsoDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function isCountedAbsent(
  rule: AbsenceCountRule,
  totals: StudentAbsenceTotals | undefined,
  lessonCount: number,
): boolean {
  if (!totals || totals.hours === 0) return false;
  return rule === 'anyPeriod' || isAbsentAllDay(totals, lessonCount);
}

export function absenceRate(absent: number, enrolled: number): number | null {
  if (enrolled <= 0) return null;
  return Math.round((absent * 10000) / enrolled) / 100;
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(2)}%`;
}

export function absenceStreakStart(
  date: string,
  wasAbsentOn: (day: string) => boolean,
  isSchoolDay: (day: string) => boolean,
): string {
  let start = date;
  let cursor = shiftIsoDate(date, -1);
  for (let step = 0; step < MAX_STREAK_LOOKBACK_DAYS; step += 1) {
    if (isSchoolDay(cursor)) {
      if (!wasAbsentOn(cursor)) break;
      start = cursor;
    }
    cursor = shiftIsoDate(cursor, -1);
  }
  return start;
}

export interface ClassAttendance {
  classId: string;
  className: string;
  enrolled: number;
  absent: number;
}

export interface LevelAttendance {
  level: number;
  classes: ClassAttendance[];
  enrolled: number;
  absent: number;
  rate: number | null;
}

export interface AttendanceInput {
  classes: Pick<SchoolClass, 'id' | 'name' | 'level'>[];
  students: Pick<Student, 'id' | 'classId' | 'gender' | 'joinDate' | 'leaveDate'>[];
  date: string;
  rule: AbsenceCountRule;
  totalsByStudent: ReadonlyMap<string, StudentAbsenceTotals>;
  lessonCountByClass: ReadonlyMap<string, number>;
}

function isStudentAbsent(input: AttendanceInput, student: AttendanceInput['students'][number]): boolean {
  return isCountedAbsent(
    input.rule,
    input.totalsByStudent.get(student.id),
    input.lessonCountByClass.get(student.classId) ?? 0,
  );
}

export function levelAttendance(input: AttendanceInput): LevelAttendance[] {
  return CLASS_LEVELS.map((level) => {
    const classes: ClassAttendance[] = input.classes
      .filter((schoolClass) => classLevelOf(schoolClass) === level)
      .map((schoolClass) => {
        const members = input.students.filter((student) => student.classId === schoolClass.id && isEnrolledOn(student, input.date));
        return {
          classId: schoolClass.id,
          className: schoolClass.name,
          enrolled: members.length,
          absent: members.filter((student) => isStudentAbsent(input, student)).length,
        };
      });
    const enrolled = classes.reduce((sum, item) => sum + item.enrolled, 0);
    const absent = classes.reduce((sum, item) => sum + item.absent, 0);
    return { level, classes, enrolled, absent, rate: absenceRate(absent, enrolled) };
  });
}

export interface PersonCounts {
  total: number;
  absent: number;
  present: number;
}

export function personCounts(total: number, absent: number): PersonCounts {
  return { total, absent, present: total - absent };
}

export interface StudentSummary {
  male: PersonCounts;
  female: PersonCounts;
  all: PersonCounts;
}

export function studentSummary(input: AttendanceInput): StudentSummary {
  const enrolled = input.students.filter((student) => isEnrolledOn(student, input.date));
  const absentOf = (gender: Student['gender'] | null) =>
    enrolled.filter((student) => (gender === null || student.gender === gender) && isStudentAbsent(input, student)).length;
  const totalOf = (gender: Student['gender'] | null) =>
    enrolled.filter((student) => gender === null || student.gender === gender).length;
  return {
    male: personCounts(totalOf('male'), absentOf('male')),
    female: personCounts(totalOf('female'), absentOf('female')),
    all: personCounts(totalOf(null), absentOf(null)),
  };
}
