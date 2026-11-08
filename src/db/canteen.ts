import { DomainError } from '@/utils/errors';
import { studentDayAbsences } from '@/utils/dailyPage1';
import { entryKey } from '@/utils/canteenPeriod';
import { planCanteenMerge } from '@/utils/canteenMerge';
import { db } from './database';
import { getModuleAccess } from './access';
import { newBaseFields, touchFields } from './records';
import type { CanteenEntry, CanteenRejectReason, CanteenResult, Institution, Student } from './types';

export interface CanteenScanInput {
  studentId: string | null;
  scannedCode: string;
  date: string;
  time: string;
  result: CanteenResult;
  reason: CanteenRejectReason | null;
  manual: boolean;
}

export async function listCanteenStudents(institutionId: string): Promise<Student[]> {
  const students = await db.students.where('institutionId').equals(institutionId).toArray();
  return students
    .filter((student) => student.deletedAt === null)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

export async function listCanteenEntries(institutionId: string, date: string): Promise<CanteenEntry[]> {
  const entries = await db.canteenEntries.where('institutionId').equals(institutionId).toArray();
  return entries
    .filter((entry) => entry.deletedAt === null && entry.date === date)
    .sort((a, b) => b.time.localeCompare(a.time));
}

export async function loadWholeDayAbsentStudentIds(
  institution: Institution,
  students: Student[],
  date: string,
): Promise<Set<string>> {
  const [classes, slots, absences] = await Promise.all([
    db.classes.where('institutionId').equals(institution.id).toArray(),
    db.timetableSlots.where('institutionId').equals(institution.id).toArray(),
    db.studentAbsences.where('institutionId').equals(institution.id).toArray(),
  ]);
  const rows = studentDayAbsences({
    date,
    students,
    classes,
    absences,
    slots,
    workingDays: institution.workingDays,
    holidayDates: institution.holidays.map((holiday) => holiday.date),
  });
  return new Set(rows.filter((row) => row.wholeDay).map((row) => row.studentId));
}

export async function listCanteenEntriesForDates(institutionId: string, dates: string[]): Promise<CanteenEntry[]> {
  const wanted = new Set(dates);
  const entries = await db.canteenEntries.where('institutionId').equals(institutionId).toArray();
  return entries.filter((entry) => entry.deletedAt === null && wanted.has(entry.date));
}

export async function loadWholeDayAbsenceKeys(
  institution: Institution,
  students: Student[],
  dates: string[],
): Promise<Set<string>> {
  const [classes, slots, absences] = await Promise.all([
    db.classes.where('institutionId').equals(institution.id).toArray(),
    db.timetableSlots.where('institutionId').equals(institution.id).toArray(),
    db.studentAbsences.where('institutionId').equals(institution.id).toArray(),
  ]);
  const holidayDates = institution.holidays.map((holiday) => holiday.date);
  const keys = new Set<string>();
  for (const date of dates) {
    const rows = studentDayAbsences({ date, students, classes, absences, slots, workingDays: institution.workingDays, holidayDates });
    for (const row of rows) if (row.wholeDay) keys.add(entryKey(row.studentId, date));
  }
  return keys;
}

export async function importCanteenEntries(institutionId: string, incoming: CanteenEntry[], actorId: string): Promise<number> {
  const access = await getModuleAccess(actorId, 'canteen');
  if (!access.canEdit) throw new DomainError('errors.notAuthorized');
  const existing = await db.canteenEntries.where('institutionId').equals(institutionId).toArray();
  const scoped = incoming.map((entry) => ({ ...entry, institutionId }));
  const plan = planCanteenMerge(existing, scoped, new Date().toISOString());
  await db.canteenEntries.bulkPut(plan);
  return plan.length;
}

export async function listAllCanteenEntries(institutionId: string): Promise<CanteenEntry[]> {
  return db.canteenEntries.where('institutionId').equals(institutionId).toArray();
}

export async function recordCanteenScan(institutionId: string, input: CanteenScanInput, actorId: string): Promise<CanteenEntry> {
  const access = await getModuleAccess(actorId, 'canteen');
  if (!access.canEdit) throw new DomainError('errors.notAuthorized');
  const record: CanteenEntry = {
    ...newBaseFields(institutionId, actorId),
    ...input,
    scannedCode: input.scannedCode.trim(),
    supervisorId: actorId,
  };
  await db.canteenEntries.add(record);
  return record;
}

export async function voidCanteenEntry(entryId: string, actorId: string): Promise<void> {
  const access = await getModuleAccess(actorId, 'canteen');
  if (!access.canEdit) throw new DomainError('errors.notAuthorized');
  const entry = await db.canteenEntries.get(entryId);
  if (!entry || entry.deletedAt !== null) throw new DomainError('errors.notFound');
  await db.canteenEntries.put({ ...entry, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
}
