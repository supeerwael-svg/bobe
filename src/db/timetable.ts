import { DomainError } from '@/utils/errors';
import { WEEK_DAY_INDEXES } from '@/utils/calendar';
import { PERIODS } from '@/utils/schedule';
import { assertCanEditClassIn, canAccessClass, getModuleAccess, type StudentAccess } from './access';
import { db } from './database';
import { newBaseFields, touchFields } from './records';
import { TEXT_MAX_LENGTH } from './studentRules';
import { addTeacherAssignmentIfMissing } from './teachers';
import { MAX_TIMETABLE_GROUPS, type Room, type SchoolClass, type Teacher, type TimetableGroup, type TimetableSlot, type TimetableSlotInput } from './types';
import { slotLessons } from '@/utils/timetableLessons';

const PERIOD_NUMBERS = PERIODS.map((period) => period.number);

export interface TimetableWorkspace {
  access: StudentAccess;
  classes: SchoolClass[];
  slots: TimetableSlot[];
  teachers: Teacher[];
  rooms: Room[];
}

export async function loadTimetableWorkspace(institutionId: string, actorId: string): Promise<TimetableWorkspace> {
  const access = await getModuleAccess(actorId, 'timetable');
  const [classes, slots, teachers, rooms] = await Promise.all([
    db.classes.where('institutionId').equals(institutionId).toArray(),
    db.timetableSlots.where('institutionId').equals(institutionId).toArray(),
    db.teachers.where('institutionId').equals(institutionId).toArray(),
    db.rooms.where('institutionId').equals(institutionId).toArray(),
  ]);
  const visibleClasses = classes
    .filter((schoolClass) => schoolClass.deletedAt === null && canAccessClass(access, schoolClass.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const visibleClassIds = new Set(visibleClasses.map((schoolClass) => schoolClass.id));
  return {
    access,
    classes: visibleClasses,
    slots: slots.filter((slot) => slot.deletedAt === null && visibleClassIds.has(slot.classId)),
    teachers: teachers
      .filter((teacher) => teacher.deletedAt === null)
      .sort((a, b) => a.name.localeCompare(b.name)),
    rooms: rooms
      .filter((room) => room.deletedAt === null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
  };
}

function cleanSubject(raw: string): string {
  const subject = raw.trim().replace(/\s+/g, ' ');
  if (subject === '') throw new DomainError('validation.required');
  if (subject.length > TEXT_MAX_LENGTH) throw new DomainError('validation.textTooLong');
  return subject;
}

function normalizeGroups(groups: TimetableGroup[] | undefined): TimetableGroup[] | undefined {
  if (!groups || groups.length < 2) return undefined;
  if (groups.length > MAX_TIMETABLE_GROUPS) throw new DomainError('timetable.errors.tooManyGroups');
  return groups.map((group, index) => ({
    groupNumber: index + 1,
    subject: cleanSubject(group.subject),
    teacherId: group.teacherId || null,
    roomId: group.roomId || null,
  }));
}

function normalizeSlot(input: TimetableSlotInput): TimetableSlotInput {
  if (!(WEEK_DAY_INDEXES as readonly number[]).includes(input.day) || !PERIOD_NUMBERS.includes(input.period)) {
    throw new DomainError('validation.invalidSlot');
  }
  const groups = normalizeGroups(input.groups);
  if (groups) {
    const [first] = groups;
    return { ...input, subject: first.subject, teacherId: first.teacherId, roomId: first.roomId, groups };
  }
  return { ...input, subject: cleanSubject(input.subject), groups: undefined };
}

async function assertActiveReferences(input: TimetableSlotInput): Promise<void> {
  const schoolClass = await db.classes.get(input.classId);
  if (!schoolClass || schoolClass.deletedAt !== null) throw new DomainError('validation.classNotFound');
  for (const lesson of slotLessons(input)) {
    if (lesson.teacherId) {
      const teacher = await db.teachers.get(lesson.teacherId);
      if (!teacher || teacher.deletedAt !== null) throw new DomainError('teachers.errors.notFound');
    }
    if (lesson.roomId) {
      const room = await db.rooms.get(lesson.roomId);
      if (!room || room.deletedAt !== null) throw new DomainError('rooms.errors.notFound');
    }
  }
}

async function writeSlot(institutionId: string, actorId: string, input: TimetableSlotInput): Promise<void> {
  const existing = await db.timetableSlots
    .where('classId')
    .equals(input.classId)
    .filter((slot) => slot.deletedAt === null && slot.day === input.day && slot.period === input.period)
    .first();

  if (existing) {
    await db.timetableSlots.put({ ...existing, ...input, ...touchFields(actorId) });
  } else {
    await db.timetableSlots.add({
      ...newBaseFields(institutionId, actorId),
      ...input,
    });
  }

  for (const lesson of slotLessons(input)) {
    if (lesson.teacherId) {
      await addTeacherAssignmentIfMissing(lesson.teacherId, input.classId, lesson.subject, actorId);
    }
  }
}

export async function saveTimetableSlot(institutionId: string, actorId: string, rawInput: TimetableSlotInput): Promise<void> {
  const input = normalizeSlot(rawInput);
  assertCanEditClassIn(await getModuleAccess(actorId, 'timetable'), input.classId);
  await assertActiveReferences(input);
  await db.transaction('rw', db.timetableSlots, db.teachers, () => writeSlot(institutionId, actorId, input));
}

export async function importTimetableSlots(
  institutionId: string,
  actorId: string,
  classId: string,
  rawInputs: TimetableSlotInput[],
): Promise<number> {
  assertCanEditClassIn(await getModuleAccess(actorId, 'timetable'), classId);
  const inputs = rawInputs.map((input) => normalizeSlot({ ...input, classId }));
  for (const input of inputs) {
    await assertActiveReferences(input);
  }
  await db.transaction('rw', db.timetableSlots, db.teachers, async () => {
    for (const input of inputs) {
      await writeSlot(institutionId, actorId, input);
    }
  });
  return inputs.length;
}

export async function clearTimetableSlot(slotId: string, actorId: string): Promise<void> {
  const slot = await db.timetableSlots.get(slotId);
  if (!slot || slot.deletedAt !== null) throw new DomainError('errors.notFound');
  assertCanEditClassIn(await getModuleAccess(actorId, 'timetable'), slot.classId);
  await db.timetableSlots.put({ ...slot, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
}

export async function restoreTimetableSlot(slotId: string, actorId: string): Promise<void> {
  const slot = await db.timetableSlots.get(slotId);
  if (!slot) throw new DomainError('errors.notFound');
  assertCanEditClassIn(await getModuleAccess(actorId, 'timetable'), slot.classId);
  const taken = await db.timetableSlots
    .where('classId')
    .equals(slot.classId)
    .filter((item) => item.deletedAt === null && item.day === slot.day && item.period === slot.period)
    .count();
  if (taken > 0) throw new DomainError('timetable.errors.slotTaken');
  await db.timetableSlots.put({ ...slot, deletedAt: null, ...touchFields(actorId) });
}
