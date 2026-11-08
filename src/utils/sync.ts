export interface SyncRecord {
  id: string;
  institutionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  updatedBy: string | null;
  [key: string]: unknown;
}

export type SyncTable = keyof typeof SYNC_TABLES;

export const SYNC_TABLES = {
  classes: 'classes',
  students: 'students',
  timetableSlots: 'timetable_slots',
  teachers: 'teachers',
  rooms: 'rooms',
  studentAbsences: 'student_absences',
  teacherAbsences: 'teacher_absences',
} as const;

export type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  error: string | null;
}

export interface SyncTransport {
  push(records: SyncRecord[], table: SyncTable): Promise<void>;
  pull(table: SyncTable, sinceUpdatedAt: string | null, institutionId: string): Promise<SyncRecord[]>;
  subscribe(table: SyncTable, institutionId: string, onChange: (records: SyncRecord[]) => void): () => void;
  status(): SyncStatus;
}
