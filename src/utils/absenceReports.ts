import type { Student, StudentAbsence, TeacherAbsence } from '@/db/types';
import { affectedClassIds, classLessonsForDay, teacherAbsenceHours, weekdayOfDate, type LessonSlot, type StudentAbsenceTotals } from '@/utils/absences';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthValue(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function isSchoolDay(date: string, workingDays: number[], holidayDates: ReadonlySet<string>): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return workingDays.includes(weekday) && !holidayDates.has(date);
}

export function schoolDaysInMonth(month: string, workingDays: number[], holidayDates: ReadonlySet<string>): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days: string[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (isSchoolDay(date, workingDays, holidayDates)) days.push(date);
  }
  return days;
}

export function isEnrolledOn(student: Pick<Student, 'joinDate' | 'leaveDate'>, date: string): boolean {
  return (student.joinDate === null || student.joinDate <= date) && (student.leaveDate === null || student.leaveDate > date);
}

export function isAbsentAllDay(totals: StudentAbsenceTotals | undefined, lessonCount: number): boolean {
  return totals !== undefined && lessonCount > 0 && totals.hours >= lessonCount;
}

export interface CanteenReport {
  halfBoarderCount: number;
  absentHalfBoarderIds: string[];
  expectedCount: number;
}

export function canteenReport(input: {
  students: Pick<Student, 'id' | 'classId' | 'boardingStatus' | 'joinDate' | 'leaveDate'>[];
  date: string;
  totalsByStudent: ReadonlyMap<string, StudentAbsenceTotals>;
  lessonCountByClass: ReadonlyMap<string, number>;
}): CanteenReport {
  const boarders = input.students.filter(
    (student) => student.boardingStatus === 'half-boarder' && isEnrolledOn(student, input.date),
  );
  const absentHalfBoarderIds = boarders
    .filter((student) =>
      isAbsentAllDay(input.totalsByStudent.get(student.id), input.lessonCountByClass.get(student.classId) ?? 0),
    )
    .map((student) => student.id);
  return {
    halfBoarderCount: boarders.length,
    absentHalfBoarderIds,
    expectedCount: boarders.length - absentHalfBoarderIds.length,
  };
}

export interface TeacherDayAbsence {
  teacherId: string;
  hours: number;
  classIds: string[];
  lessons: TeacherAbsence['lessons'];
  reason?: TeacherAbsence['reason'];
  reasonNote?: string;
}

export function teacherDayAbsences(
  records: Pick<TeacherAbsence, 'teacherId' | 'date' | 'lessons' | 'reason' | 'reasonNote'>[],
  date: string,
): TeacherDayAbsence[] {
  return records
    .filter((record) => record.date === date)
    .map((record) => ({
      teacherId: record.teacherId,
      hours: teacherAbsenceHours(record.lessons),
      classIds: affectedClassIds(record.lessons),
      lessons: record.lessons,
      reason: record.reason,
      reasonNote: record.reasonNote,
    }));
}

export interface MonthlyClassRate {
  classId: string;
  studentCount: number;
  classHours: number;
  requiredHours: number;
  hours: number;
  justifiedHours: number;
  unjustifiedHours: number;
  rate: number | null;
  hasTimetable: boolean;
}

export interface MonthlyAbsenceInput {
  classIds: string[];
  students: Pick<Student, 'classId' | 'joinDate' | 'leaveDate'>[];
  studentAbsences: Pick<StudentAbsence, 'classId' | 'date' | 'justified'>[];
  schoolDays: string[];
  slots: LessonSlot[];
}

function roundRate(value: number): number {
  return Math.round(value * 100) / 100;
}

function rateOf(hours: number, requiredHours: number): number | null {
  return requiredHours > 0 ? roundRate((hours * 100) / requiredHours) : null;
}

export type MonthlyTotals = Omit<MonthlyClassRate, 'classId' | 'hasTimetable'>;

export function classMonthlyHours(slots: LessonSlot[], classId: string, schoolDays: string[]): number {
  let total = 0;
  for (const date of schoolDays) {
    total += classLessonsForDay(slots, classId, weekdayOfDate(date)).length;
  }
  return total;
}

export function monthlyAbsenceRates(input: MonthlyAbsenceInput): { rows: MonthlyClassRate[]; total: MonthlyTotals } {
  const schoolDaySet = new Set(input.schoolDays);
  const studentsByClass = new Map<string, number>();
  for (const student of input.students) {
    studentsByClass.set(student.classId, (studentsByClass.get(student.classId) ?? 0) + 1);
  }

  const rows = new Map<string, MonthlyClassRate>(
    input.classIds.map((classId) => {
      const monthlyHours = classMonthlyHours(input.slots, classId, input.schoolDays);
      const studentCount = studentsByClass.get(classId) ?? 0;
      return [
        classId,
        {
          classId,
          studentCount,
          classHours: monthlyHours,
          requiredHours: monthlyHours * studentCount,
          hours: 0,
          justifiedHours: 0,
          unjustifiedHours: 0,
          rate: null,
          hasTimetable: monthlyHours > 0,
        },
      ];
    }),
  );

  for (const record of input.studentAbsences) {
    const row = rows.get(record.classId);
    if (!row || !schoolDaySet.has(record.date)) continue;
    row.hours += 1;
    if (record.justified) row.justifiedHours += 1;
    else row.unjustifiedHours += 1;
  }

  const ordered = input.classIds.map((classId) => rows.get(classId)).filter((row): row is MonthlyClassRate => row !== undefined);
  for (const row of ordered) row.rate = rateOf(row.hours, row.requiredHours);

  const sum = (key: 'requiredHours' | 'hours' | 'justifiedHours' | 'unjustifiedHours') =>
    ordered.reduce((acc, row) => acc + row[key], 0);
  const total: MonthlyTotals = {
    studentCount: ordered.reduce((acc, row) => acc + row.studentCount, 0),
    classHours: ordered.reduce((acc, row) => acc + row.classHours, 0),
    requiredHours: sum('requiredHours'),
    hours: sum('hours'),
    justifiedHours: sum('justifiedHours'),
    unjustifiedHours: sum('unjustifiedHours'),
    rate: null,
  };
  total.rate = rateOf(total.hours, total.requiredHours);

  return { rows: ordered, total };
}

export function monthlyMovements<T extends Pick<Student, 'joinDate' | 'leaveDate'>>(
  students: T[],
  month: string,
): { joined: T[]; left: T[] } {
  return {
    joined: students.filter((student) => student.joinDate?.startsWith(month) ?? false),
    left: students.filter((student) => student.leaveDate?.startsWith(month) ?? false),
  };
}
