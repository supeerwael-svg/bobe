import { DomainError } from '@/utils/errors';
import { classLessonsForDay, isIsoDate, teacherLessonsForDay, weekdayOfDate } from '@/utils/absences';
import { assertCanEditClassIn, canAccessClass, getModuleAccess, type StudentAccess } from './access';
import { db } from './database';
import { getInstitution } from './institutions';
import { newBaseFields, touchFields } from './records';
import { assertHeadActor } from './users';
import type { SchoolClass, Student, StudentAbsence, Teacher, TeacherAbsence, TeacherAbsenceReason, TimetableSlot, User } from './types';

export interface AbsenceWorkspace {
  access: StudentAccess;
  workingDays: number[];
  holidayDates: string[];
  classes: SchoolClass[];
  students: Student[];
  slots: TimetableSlot[];
  studentAbsences: StudentAbsence[];
  teachers: Teacher[];
  teacherAbsences: TeacherAbsence[];
  supervisors: User[];
}

export async function loadAbsenceWorkspace(institutionId: string, actorId: string): Promise<AbsenceWorkspace> {
  const access = await getModuleAccess(actorId, 'attendance');
  const institution = await getInstitution(institutionId);
  const [classes, students, slots, studentAbsences, teachers, teacherAbsences, users] = await Promise.all([
    db.classes.where('institutionId').equals(institutionId).toArray(),
    db.students.where('institutionId').equals(institutionId).toArray(),
    db.timetableSlots.where('institutionId').equals(institutionId).toArray(),
    db.studentAbsences.where('institutionId').equals(institutionId).toArray(),
    access.isHead ? db.teachers.where('institutionId').equals(institutionId).toArray() : Promise.resolve([]),
    access.isHead ? db.teacherAbsences.where('institutionId').equals(institutionId).toArray() : Promise.resolve([]),
    access.isHead ? db.users.where('institutionId').equals(institutionId).toArray() : Promise.resolve([]),
  ]);
  const visibleClassIds = new Set(
    classes.filter((schoolClass) => schoolClass.deletedAt === null && canAccessClass(access, schoolClass.id)).map((item) => item.id),
  );
  return {
    access,
    workingDays: institution.workingDays,
    holidayDates: institution.holidays.map((holiday) => holiday.date),
    classes: classes
      .filter((schoolClass) => visibleClassIds.has(schoolClass.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    students: students.filter((student) => student.deletedAt === null && visibleClassIds.has(student.classId)),
    slots: slots.filter((slot) => slot.deletedAt === null && visibleClassIds.has(slot.classId)),
    studentAbsences: studentAbsences.filter((record) => record.deletedAt === null && visibleClassIds.has(record.classId)),
    teachers: teachers.filter((teacher) => teacher.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name)),
    teacherAbsences: teacherAbsences.filter((record) => record.deletedAt === null),
    supervisors: users
      .filter((user) => user.role === 'supervisor' && user.status === 'approved' && user.deletedAt === null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface StudentAbsenceEntry {
  studentId: string;
  period: number;
  justified: boolean;
}

function assertValidDate(date: string, workingDays: number[]): void {
  if (!isIsoDate(date)) throw new DomainError('validation.invalidDate');
  if (!workingDays.includes(weekdayOfDate(date))) throw new DomainError('validation.dayNotWorking');
}

export async function saveClassDayAbsences(
  institutionId: string,
  actorId: string,
  classId: string,
  date: string,
  entries: StudentAbsenceEntry[],
): Promise<void> {
  assertCanEditClassIn(await getModuleAccess(actorId, 'attendance'), classId);
  const schoolClass = await db.classes.get(classId);
  if (!schoolClass || schoolClass.deletedAt !== null) throw new DomainError('validation.classNotFound');
  const institution = await getInstitution(institutionId);
  assertValidDate(date, institution.workingDays);

  const day = weekdayOfDate(date);
  const slots = await db.timetableSlots.where('classId').equals(classId).filter((slot) => slot.deletedAt === null).toArray();
  const lessons = classLessonsForDay(slots, classId, day);
  const lessonByPeriod = new Map(lessons.map((lesson) => [lesson.period, lesson]));

  const students = await db.students.where('classId').equals(classId).filter((student) => student.deletedAt === null).toArray();
  const studentIds = new Set(students.map((student) => student.id));

  const unique = new Map<string, StudentAbsenceEntry>();
  for (const entry of entries) {
    if (!lessonByPeriod.has(entry.period)) throw new DomainError('validation.invalidSlot');
    if (!studentIds.has(entry.studentId)) throw new DomainError('errors.notFound');
    unique.set(`${entry.studentId}|${entry.period}`, entry);
  }

  await db.transaction('rw', db.studentAbsences, async () => {
    const existing = await db.studentAbsences
      .where('classId')
      .equals(classId)
      .filter((record) => record.deletedAt === null && record.date === date)
      .toArray();
    for (const record of existing) {
      await db.studentAbsences.put({ ...record, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
    }
    for (const entry of unique.values()) {
      const lesson = lessonByPeriod.get(entry.period);
      if (!lesson) continue;
      await db.studentAbsences.add({
        ...newBaseFields(institutionId, actorId),
        classId,
        studentId: entry.studentId,
        date,
        period: entry.period,
        subject: lesson.subject,
        justified: entry.justified,
      });
    }
  });
}

export async function saveTeacherAbsence(
  institutionId: string,
  actorId: string,
  teacherId: string,
  date: string,
  periods: number[],
  reason: { reason?: TeacherAbsenceReason; reasonNote: string },
): Promise<void> {
  await assertHeadActor(actorId);
  const teacher = await db.teachers.get(teacherId);
  if (!teacher || teacher.deletedAt !== null) throw new DomainError('teachers.errors.notFound');
  const institution = await getInstitution(institutionId);
  assertValidDate(date, institution.workingDays);

  const slots = await db.timetableSlots
    .where('institutionId')
    .equals(institutionId)
    .filter((slot) => slot.deletedAt === null && slot.teacherId === teacherId)
    .toArray();
  const teacherLessons = teacherLessonsForDay(slots, teacherId, weekdayOfDate(date));
  const selected = teacherLessons.filter((lesson) => periods.includes(lesson.period));
  if (selected.length !== new Set(periods).size) throw new DomainError('validation.invalidSlot');

  await db.transaction('rw', db.teacherAbsences, async () => {
    const existing = await db.teacherAbsences
      .where('teacherId')
      .equals(teacherId)
      .filter((record) => record.deletedAt === null && record.date === date)
      .toArray();
    for (const record of existing) {
      await db.teacherAbsences.put({ ...record, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
    }
    if (selected.length > 0) {
      await db.teacherAbsences.add({
        ...newBaseFields(institutionId, actorId),
        teacherId,
        date,
        lessons: selected,
        reason: reason.reason,
        reasonNote: reason.reasonNote.trim(),
      });
    }
  });
}

export async function deleteTeacherAbsence(absenceId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const record = await db.teacherAbsences.get(absenceId);
  if (!record || record.deletedAt !== null) throw new DomainError('errors.notFound');
  await db.teacherAbsences.put({ ...record, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
}

export async function restoreTeacherAbsence(absenceId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const record = await db.teacherAbsences.get(absenceId);
  if (!record) throw new DomainError('errors.notFound');
  const clash = await db.teacherAbsences
    .where('teacherId')
    .equals(record.teacherId)
    .filter((item) => item.deletedAt === null && item.date === record.date)
    .count();
  if (clash > 0) throw new DomainError('absences.errors.alreadyRecorded');
  await db.teacherAbsences.put({ ...record, deletedAt: null, ...touchFields(actorId) });
}
