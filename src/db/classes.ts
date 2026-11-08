import { DomainError } from '@/utils/errors';
import { guessClassLevel, CLASS_LEVELS } from '@/utils/classLevel';
import { normalizeText } from '@/utils/text';
import { maxLengthKey, requiredKey } from '@/utils/validation';
import { db } from './database';
import { newBaseFields, touchFields } from './records';
import { assertHeadActor } from './users';
import type { SchoolClass } from './types';

export const CLASS_NAME_MAX_LENGTH = 40;

export async function listClasses(institutionId: string): Promise<SchoolClass[]> {
  const classes = await db.classes.where('institutionId').equals(institutionId).toArray();
  return classes
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function getActiveClass(classId: string): Promise<SchoolClass> {
  const schoolClass = await db.classes.get(classId);
  if (!schoolClass || schoolClass.deletedAt !== null) {
    throw new DomainError('errors.notFound');
  }
  return schoolClass;
}

function prepareClassName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  const issue = requiredKey(cleaned) ?? maxLengthKey(cleaned, CLASS_NAME_MAX_LENGTH, 'validation.classTooLong');
  if (issue) throw new DomainError(issue);
  return cleaned;
}

async function assertClassNameAvailable(institutionId: string, name: string, exceptId: string | null): Promise<void> {
  const key = normalizeText(name);
  const classes = await db.classes.where('institutionId').equals(institutionId).toArray();
  const taken = classes.some(
    (item) => item.deletedAt === null && item.id !== exceptId && normalizeText(item.name) === key,
  );
  if (taken) {
    throw new DomainError('validation.classDuplicate');
  }
}

export async function createClass(institutionId: string, name: string, actorId: string): Promise<SchoolClass> {
  await assertHeadActor(actorId);
  const cleanName = prepareClassName(name);
  await assertClassNameAvailable(institutionId, cleanName, null);
  const record: SchoolClass = { ...newBaseFields(institutionId, actorId), name: cleanName, level: guessClassLevel(cleanName) };
  await db.classes.add(record);
  return record;
}

export async function renameClass(
  classId: string,
  name: string,
  level: number | null,
  actorId: string,
): Promise<void> {
  await assertHeadActor(actorId);
  const schoolClass = await getActiveClass(classId);
  const cleanName = prepareClassName(name);
  if (level !== null && !CLASS_LEVELS.includes(level as (typeof CLASS_LEVELS)[number])) {
    throw new DomainError('validation.classLevelInvalid');
  }
  await assertClassNameAvailable(schoolClass.institutionId, cleanName, classId);
  await db.classes.put({ ...schoolClass, name: cleanName, level, ...touchFields(actorId) });
}

export async function deleteClass(classId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const schoolClass = await getActiveClass(classId);
  const activeStudents = await db.students
    .where('classId')
    .equals(classId)
    .filter((student) => student.deletedAt === null)
    .count();
  if (activeStudents > 0) {
    throw new DomainError('classes.errors.hasStudents');
  }
  await db.classes.put({ ...schoolClass, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
}

export async function restoreClass(classId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const schoolClass = await db.classes.get(classId);
  if (!schoolClass) throw new DomainError('errors.notFound');
  await assertClassNameAvailable(schoolClass.institutionId, schoolClass.name, classId);
  await db.classes.put({ ...schoolClass, deletedAt: null, ...touchFields(actorId) });
}
