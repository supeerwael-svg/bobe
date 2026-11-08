export interface BaseRecord {
  id: string;
  institutionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  updatedBy: string | null;
}

export interface Holiday {
  date: string;
  name: string;
}

export const CANTEEN_MATCH_FIELDS = ['cardCode', 'studentId'] as const;
export type CanteenMatchField = (typeof CANTEEN_MATCH_FIELDS)[number];

export const ABSENCE_COUNT_RULES = ['wholeDay', 'anyPeriod'] as const;
export type AbsenceCountRule = (typeof ABSENCE_COUNT_RULES)[number];

export interface Institution extends BaseRecord {
  name: string;
  rooms: number;
  holidays: Holiday[];
  workingDays: number[];
  inviteCode: string;
  directorate?: string;
  city?: string;
  reportNumberPrefix?: string;
  absenceCountRule?: AbsenceCountRule;
  canteenMatchField?: CanteenMatchField;
  canteenDays?: number[];
  canteenTrackingStart?: string | null;
}

export const MODULE_IDS = ['students', 'attendance', 'timetable', 'grades', 'reports', 'canteen'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type AccessLevel = 'edit' | 'view';
export type SearchScope = 'assigned' | 'institution';

export interface SupervisorPermissions {
  assignedClasses: string[];
  searchScope: SearchScope;
  modules: Record<ModuleId, AccessLevel>;
}

export type UserRole = 'head' | 'supervisor';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User extends BaseRecord {
  name: string;
  usernameKey: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  permissions: SupervisorPermissions | null;
}

export interface SchoolClass extends BaseRecord {
  name: string;
  level?: number | null;
}

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const BOARDING_STATUSES = ['half-boarder', 'external'] as const;
export type BoardingStatus = (typeof BOARDING_STATUSES)[number];

export interface StudentInput {
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string | null;
  placeOfBirth: string;
  repeater: boolean;
  boardingStatus: BoardingStatus;
  classId: string;
  joinDate: string | null;
  leaveDate: string | null;
  cardCode?: string | null;
}

export interface Student extends BaseRecord, StudentInput {}

export const MAX_TIMETABLE_GROUPS = 3;

export interface TimetableGroup {
  groupNumber: number;
  subject: string;
  teacherId: string | null;
  roomId: string | null;
}

export interface TimetableSlotInput {
  classId: string;
  day: number;
  period: number;
  subject: string;
  teacherId: string | null;
  roomId: string | null;
  groups?: TimetableGroup[];
}

export interface TimetableSlot extends BaseRecord, TimetableSlotInput {}

export interface TeacherAssignment {
  classId: string;
  subject: string;
}

export interface Teacher extends BaseRecord {
  name: string;
  assignments: TeacherAssignment[];
}

export interface Room extends BaseRecord {
  name: string;
}

export interface StudentAbsenceInput {
  classId: string;
  studentId: string;
  date: string;
  period: number;
  subject: string;
  justified: boolean;
}

export interface StudentAbsence extends BaseRecord, StudentAbsenceInput {}

export interface TeacherAbsenceLesson {
  period: number;
  classId: string;
  subject: string;
}

export const TEACHER_ABSENCE_REASONS = ['sickLeave', 'requested', 'other'] as const;
export type TeacherAbsenceReason = (typeof TEACHER_ABSENCE_REASONS)[number];

export interface TeacherAbsence extends BaseRecord {
  teacherId: string;
  date: string;
  lessons: TeacherAbsenceLesson[];
  reason?: TeacherAbsenceReason;
  reasonNote?: string;
}

export const CANTEEN_RESULTS = ['accepted', 'rejected'] as const;
export type CanteenResult = (typeof CANTEEN_RESULTS)[number];

export const CANTEEN_REJECT_REASONS = ['duplicate', 'external', 'unknown', 'left'] as const;
export type CanteenRejectReason = (typeof CANTEEN_REJECT_REASONS)[number];

export interface CanteenEntry extends BaseRecord {
  studentId: string | null;
  scannedCode: string;
  date: string;
  time: string;
  result: CanteenResult;
  reason: CanteenRejectReason | null;
  manual: boolean;
  supervisorId: string | null;
}

export interface ParentCorrespondenceRow {
  studentId: string | null;
  name: string;
  className: string;
  hours: string;
  absenceDate: string;
  reason: string;
  firstNotice: string;
  secondNotice: string;
  excuse: string;
  struckDate: string;
}

export const SUPERVISOR_ATTENDANCE = ['none', 'absent', 'late'] as const;
export type SupervisorAttendance = (typeof SUPERVISOR_ATTENDANCE)[number];

export interface SupervisorAbsenceRow {
  supervisorId: string | null;
  name: string;
  morning: SupervisorAttendance;
  evening: SupervisorAttendance;
  notes: string;
}

export interface DailyReportRecord {
  id: string;
  institutionId: string;
  date: string;
  reportNumber: string;
  schoolYear: string;
  parentRows: ParentCorrespondenceRow[];
  counselorNotes: string;
  observationsActions: string;
  canteenNote: string;
  supervisorRows: SupervisorAbsenceRow[];
  teacherNotes: Record<string, string>;
  updatedAt: string;
}
