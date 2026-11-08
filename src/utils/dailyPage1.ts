import type { BoardingStatus, SchoolClass, Student, StudentAbsence } from '@/db/types';
import { isAbsentAllDay, isEnrolledOn, isSchoolDay } from '@/utils/absenceReports';
import { absenceStreakStart } from '@/utils/dailyReportStats';
import { classLessonsForDay, summarizeStudentAbsences, weekdayOfDate, type LessonSlot, type StudentAbsenceTotals } from '@/utils/absences';

export interface StudentDayAbsence {
  studentId: string;
  name: string;
  className: string;
  boarding: BoardingStatus;
  hours: number;
  wholeDay: boolean;
  since: string;
  periods: number[];
}

export interface DailyAbsenceInput {
  date: string;
  students: Student[];
  classes: SchoolClass[];
  absences: StudentAbsence[];
  slots: LessonSlot[];
  workingDays: number[];
  holidayDates: string[];
}

export function studentDayAbsences(input: DailyAbsenceInput): StudentDayAbsence[] {
  const classById = new Map(input.classes.map((item) => [item.id, item]));
  const holidays = new Set(input.holidayDates);
  const totalsCache = new Map<string, Map<string, StudentAbsenceTotals>>();
  const totalsOn = (day: string) => {
    let totals = totalsCache.get(day);
    if (!totals) {
      totals = summarizeStudentAbsences(input.absences, day);
      totalsCache.set(day, totals);
    }
    return totals;
  };
  const lessonCount = (classId: string, day: string) => classLessonsForDay(input.slots, classId, weekdayOfDate(day)).length;
  const wholeDayOn = (student: Student, day: string) =>
    isAbsentAllDay(totalsOn(day).get(student.id), lessonCount(student.classId, day));

  const result: StudentDayAbsence[] = [];
  for (const student of input.students) {
    if (!isEnrolledOn(student, input.date)) continue;
    const totals = totalsOn(input.date).get(student.id);
    if (!totals || totals.hours === 0) continue;
    const wholeDay = wholeDayOn(student, input.date);
    const periods = [
      ...new Set(input.absences.filter((item) => item.studentId === student.id && item.date === input.date).map((item) => item.period)),
    ].sort((a, b) => a - b);
    result.push({
      studentId: student.id,
      name: `${student.firstName} ${student.lastName}`,
      className: classById.get(student.classId)?.name ?? '',
      boarding: student.boardingStatus,
      hours: totals.hours,
      wholeDay,
      since: wholeDay
        ? absenceStreakStart(input.date, (day) => wholeDayOn(student, day), (day) => isSchoolDay(day, input.workingDays, holidays))
        : input.date,
      periods,
    });
  }
  return result.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.name.localeCompare(b.name));
}

export function formatPeriods(periods: number[]): string {
  return periods.join(', ');
}
