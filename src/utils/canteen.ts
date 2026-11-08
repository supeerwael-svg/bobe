import type {
  CanteenEntry,
  CanteenMatchField,
  CanteenRejectReason,
  Student,
} from '../db/types';

export function findStudentByCode(
  students: Student[],
  scanned: string,
  field: CanteenMatchField,
): Student | null {
  const code = scanned.trim();
  if (!code) return null;
  return (
    students.find((student) => {
      if (student.deletedAt) return false;
      if (field === 'studentId') return student.id === code;
      return (student.cardCode ?? '').trim() === code;
    }) ?? null
  );
}

export type ScanDecision =
  | { kind: 'accepted'; student: Student }
  | { kind: 'needsConfirmation'; student: Student }
  | {
      kind: 'rejected';
      reason: CanteenRejectReason;
      student: Student | null;
      firstEntryTime: string | null;
    };

export interface ScanContext {
  student: Student | null;
  date: string;
  todayEntries: CanteenEntry[];
  absentToday: boolean;
  confirmedAbsent: boolean;
}

export function decideScan(context: ScanContext): ScanDecision {
  const { student, date, todayEntries, absentToday, confirmedAbsent } = context;
  if (!student) return { kind: 'rejected', reason: 'unknown', student: null, firstEntryTime: null };
  if (student.leaveDate && student.leaveDate < date) {
    return { kind: 'rejected', reason: 'left', student, firstEntryTime: null };
  }
  if (student.boardingStatus === 'external') {
    return { kind: 'rejected', reason: 'external', student, firstEntryTime: null };
  }
  const first = acceptedEntriesFor(todayEntries, student.id)[0];
  if (first) {
    return { kind: 'rejected', reason: 'duplicate', student, firstEntryTime: first.time };
  }
  if (absentToday && !confirmedAbsent) return { kind: 'needsConfirmation', student };
  return { kind: 'accepted', student };
}

function acceptedEntriesFor(entries: CanteenEntry[], studentId: string): CanteenEntry[] {
  return entries
    .filter((entry) => !entry.deletedAt && entry.result === 'accepted' && entry.studentId === studentId)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export interface CanteenCounters {
  accepted: number;
  rejected: number;
  halfBoarders: number;
  remaining: number;
}

export function computeCanteenCounters(
  students: Student[],
  entries: CanteenEntry[],
  date: string,
): CanteenCounters {
  const todays = entries.filter((entry) => !entry.deletedAt && entry.date === date);
  const acceptedIds = new Set(
    todays.filter((entry) => entry.result === 'accepted' && entry.studentId).map((entry) => entry.studentId),
  );
  const halfBoarders = students.filter(
    (student) =>
      !student.deletedAt &&
      student.boardingStatus === 'half-boarder' &&
      (!student.leaveDate || student.leaveDate >= date),
  );
  const enteredHalfBoarders = halfBoarders.filter((student) => acceptedIds.has(student.id)).length;
  return {
    accepted: acceptedIds.size,
    rejected: todays.filter((entry) => entry.result === 'rejected').length,
    halfBoarders: halfBoarders.length,
    remaining: halfBoarders.length - enteredHalfBoarders,
  };
}
