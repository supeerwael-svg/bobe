import { DomainError } from '@/utils/errors';
import { slotLessons, unassignTeacherFromSlot } from '@/utils/timetableLessons';
import { assertHeadActor } from './users';
import { db } from './database';
import { newBaseFields, touchFields } from './records';
import { TEXT_MAX_LENGTH } from './studentRules';
import type { Teacher, TeacherAssignment } from './types';

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name === '') throw new DomainError('validation.required');
  if (name.length > TEXT_MAX_LENGTH) throw new DomainError('validation.textTooLong');
  return name;
}

function sameAssignment(a: TeacherAssignment, classId: string, subject: string): boolean {
  return a.classId === classId && a.subject === subject;
}

export async function listTeachers(institutionId: string): Promise<Teacher[]> {
  const teachers = await db.teachers.where('institutionId').equals(institutionId).toArray();
  return teachers
    .filter((teacher) => teacher.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTeacher(institutionId: string, rawName: string, actorId: string): Promise<Teacher> {
  await assertHeadActor(actorId);
  const record: Teacher = { ...newBaseFields(institutionId, actorId), name: cleanName(rawName), assignments: [] };
  await db.teachers.add(record);
  return record;
}

export async function deleteTeacher(teacherId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const teacher = await db.teachers.get(teacherId);
  if (!teacher || teacher.deletedAt !== null) throw new DomainError('teachers.errors.notFound');
  const inUse = await db.timetableSlots
    .where('institutionId')
    .equals(teacher.institutionId)
    .filter((slot) => slot.deletedAt === null && slotLessons(slot).some((lesson) => lesson.teacherId === teacherId))
    .count();
  if (inUse > 0) throw new DomainError('teachers.errors.inUse');
  await db.teachers.put({ ...teacher, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
}

export async function restoreTeacher(teacherId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const teacher = await db.teachers.get(teacherId);
  if (!teacher) throw new DomainError('teachers.errors.notFound');
  await db.teachers.put({ ...teacher, deletedAt: null, ...touchFields(actorId) });
}

export async function addTeacherAssignment(
  teacherId: string,
  classId: string,
  subject: string,
  actorId: string,
): Promise<void> {
  await assertHeadActor(actorId);
  const cleanSubject = cleanName(subject);
  const schoolClass = await db.classes.get(classId);
  if (!schoolClass || schoolClass.deletedAt !== null) throw new DomainError('validation.classNotFound');
  await addTeacherAssignmentIfMissing(teacherId, classId, cleanSubject, actorId);
}

export async function removeTeacherAssignment(
  teacherId: string,
  classId: string,
  subject: string,
  actorId: string,
): Promise<void> {
  await assertHeadActor(actorId);
  await db.transaction('rw', db.teachers, db.timetableSlots, async () => {
    const teacher = await db.teachers.get(teacherId);
    if (!teacher || teacher.deletedAt !== null) throw new DomainError('teachers.errors.notFound');
    await db.teachers.put({
      ...teacher,
      assignments: teacher.assignments.filter((item) => !sameAssignment(item, classId, subject)),
      ...touchFields(actorId),
    });
    const slots = await db.timetableSlots.where('institutionId').equals(teacher.institutionId).toArray();
    for (const slot of slots) {
      if (slot.deletedAt !== null || slot.classId !== classId) continue;
      const updated = unassignTeacherFromSlot(slot, teacherId, subject);
      if (updated !== slot) await db.timetableSlots.put({ ...updated, ...touchFields(actorId) });
    }
  });
}

export async function regenerateTeacherAssignments(institutionId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  await db.transaction('rw', db.teachers, db.timetableSlots, async () => {
    const [teachers, slots] = await Promise.all([
      db.teachers.where('institutionId').equals(institutionId).toArray(),
      db.timetableSlots.where('institutionId').equals(institutionId).toArray(),
    ]);
    for (const teacher of teachers) {
      if (teacher.deletedAt !== null) continue;
      const assignments: TeacherAssignment[] = [];
      for (const slot of slots) {
        if (slot.deletedAt !== null) continue;
        for (const lesson of slotLessons(slot)) {
          if (lesson.teacherId !== teacher.id) continue;
          if (!assignments.some((item) => sameAssignment(item, slot.classId, lesson.subject))) {
            assignments.push({ classId: slot.classId, subject: lesson.subject });
          }
        }
      }
      await db.teachers.put({ ...teacher, assignments, ...touchFields(actorId) });
    }
  });
}

export async function addTeacherAssignmentIfMissing(
  teacherId: string,
  classId: string,
  subject: string,
  actorId: string,
): Promise<void> {
  const teacher = await db.teachers.get(teacherId);
  if (!teacher || teacher.deletedAt !== null) throw new DomainError('teachers.errors.notFound');
  if (teacher.assignments.some((item) => sameAssignment(item, classId, subject))) return;
  await db.teachers.put({
    ...teacher,
    assignments: [...teacher.assignments, { classId, subject }],
    ...touchFields(actorId),
  });
}
