import { db } from '@/db/database';
import { getStudentAccess } from '@/db/access';
import { normalizeText } from '@/utils/text';
import type { SchoolClass, Student, Teacher, TimetableSlot } from '@/db/types';

export interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  gender: string;
  boardingStatus: string;
}

export interface TeacherSearchResult {
  id: string;
  name: string;
  subjects: string[];
  classNames: string[];
}

export interface TeacherScheduleResult {
  id: string;
  name: string;
  className: string | null;
  roomName: string | null;
  subject: string | null;
  period: number;
}

export interface TimetableSearchResult {
  id: string;
  className: string;
  day: number;
  period: number;
  subject: string;
  teacherName: string;
  roomName: string;
}

function matchesQuery(haystack: string, query: string): boolean {
  return normalizeText(haystack).includes(normalizeText(query));
}

export async function searchStudents(
  institutionId: string,
  actorId: string,
  query: string,
): Promise<StudentSearchResult[]> {
  if (!query.trim()) return [];
  const access = await getStudentAccess(actorId);
  let students = await db.students
    .where('institutionId')
    .equals(institutionId)
    .filter((s) => s.deletedAt === null)
    .toArray();

  if (!access.isHead && access.searchScope === 'assigned') {
    const allowed = new Set(access.visibleClassIds);
    students = students.filter((s) => allowed.has(s.classId));
  }

  const classMap = new Map<string, string>();
  const classes = await db.classes.where('institutionId').equals(institutionId).toArray();
  for (const c of classes) classMap.set(c.id, c.name);

  return students
    .filter(
      (s) =>
        matchesQuery(`${s.firstName} ${s.lastName}`, query) ||
        matchesQuery(s.lastName, query) ||
        matchesQuery(s.firstName, query) ||
        matchesQuery(classMap.get(s.classId) ?? '', query),
    )
    .map((s: Student) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: classMap.get(s.classId) ?? '',
      gender: s.gender,
      boardingStatus: s.boardingStatus,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

export async function searchTeachers(
  institutionId: string,
  actorId: string,
  query: string,
): Promise<TeacherSearchResult[]> {
  if (!query.trim()) return [];
  const access = await getStudentAccess(actorId);

  let teachers = await db.teachers
    .where('institutionId')
    .equals(institutionId)
    .filter((t) => t.deletedAt === null)
    .toArray();

  const allClasses = await db.classes.where('institutionId').equals(institutionId).toArray();
  const classMap = new Map<string, string>();
  for (const c of allClasses) classMap.set(c.id, c.name);

  if (!access.isHead && access.searchScope === 'assigned') {
    const allowed = new Set(access.visibleClassIds);
    teachers = teachers.filter((t) =>
      t.assignments.some((a) => allowed.has(a.classId)),
    );
  }

  return teachers
    .filter((t) => {
      if (matchesQuery(t.name, query)) return true;
      return t.assignments.some((a) => matchesQuery(a.subject, query) || matchesQuery(classMap.get(a.classId) ?? '', query));
    })
    .map((t: Teacher) => {
      const subjects = [...new Set(t.assignments.map((a) => a.subject))];
      const classNames = [...new Set(t.assignments.map((a) => classMap.get(a.classId) ?? ''))].filter(Boolean);
      return { id: t.id, name: t.name, subjects, classNames };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchTimetables(
  institutionId: string,
  actorId: string,
  query: string,
): Promise<TimetableSearchResult[]> {
  if (!query.trim()) return [];
  const access = await getStudentAccess(actorId);

  let slots = await db.timetableSlots
    .where('institutionId')
    .equals(institutionId)
    .filter((s) => s.deletedAt === null)
    .toArray();

  if (!access.isHead && access.searchScope === 'assigned') {
    const allowed = new Set(access.visibleClassIds);
    slots = slots.filter((s: TimetableSlot) => allowed.has(s.classId));
  }

  const classMap = new Map<string, SchoolClass>();
  const classes = await db.classes.where('institutionId').equals(institutionId).toArray();
  for (const c of classes) classMap.set(c.id, c);

  const teacherMap = new Map<string, string>();
  const teachers = await db.teachers.where('institutionId').equals(institutionId).toArray();
  for (const t of teachers) teacherMap.set(t.id, t.name);

  const roomMap = new Map<string, string>();
  const rooms = await db.rooms.where('institutionId').equals(institutionId).toArray();
  for (const r of rooms) roomMap.set(r.id, r.name);

  return slots
    .filter((s) => {
      const className = classMap.get(s.classId)?.name ?? '';
      const teacherName = s.teacherId ? teacherMap.get(s.teacherId) ?? '' : '';
      if (matchesQuery(s.subject, query)) return true;
      if (matchesQuery(className, query)) return true;
      if (matchesQuery(teacherName, query)) return true;
      return false;
    })
    .map((s: TimetableSlot) => ({
      id: s.id,
      className: classMap.get(s.classId)?.name ?? '',
      day: s.day,
      period: s.period,
      subject: s.subject,
      teacherName: s.teacherId ? teacherMap.get(s.teacherId) ?? '' : '',
      roomName: s.roomId ? roomMap.get(s.roomId) ?? '' : '',
    }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.day - b.day || a.period - b.period);
}

export async function searchTeacherSchedule(
  institutionId: string,
  actorId: string,
  query: string,
  day: number,
  period: number,
): Promise<TeacherScheduleResult[]> {
  const normalizedQuery = normalizeText(query);
  const access = await getStudentAccess(actorId);
  const visibleClassIds = new Set(access.visibleClassIds);
  const [teachers, slots, classes, rooms] = await Promise.all([
    db.teachers.where('institutionId').equals(institutionId).toArray(),
    db.timetableSlots.where('institutionId').equals(institutionId).toArray(),
    db.classes.where('institutionId').equals(institutionId).toArray(),
    db.rooms.where('institutionId').equals(institutionId).toArray(),
  ]);
  const classMap = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass.name]));
  const roomMap = new Map(rooms.map((room) => [room.id, room.name]));
  const matchingSlots = slots.filter(
    (slot) => slot.deletedAt === null && slot.day === day && slot.period === period && (access.isHead || access.searchScope !== 'assigned' || visibleClassIds.has(slot.classId)),
  );
  const activeTeachers = teachers
    .filter((teacher) => teacher.deletedAt === null)
    .filter((teacher) => !normalizedQuery || matchesQuery(teacher.name, query))
    .filter((teacher) => access.isHead || access.searchScope !== 'assigned' || teacher.assignments.some((assignment) => visibleClassIds.has(assignment.classId)));

  return activeTeachers
    .flatMap((teacher): TeacherScheduleResult[] => {
      const teacherSlots = matchingSlots.filter((slot) => slot.teacherId === teacher.id);
      if (teacherSlots.length === 0) {
        return [{ id: teacher.id, name: teacher.name, className: null, roomName: null, subject: null, period }];
      }
      return teacherSlots.map((slot) => ({
        id: teacher.id,
        name: teacher.name,
        className: classMap.get(slot.classId) ?? '',
        roomName: slot.roomId ? roomMap.get(slot.roomId) ?? null : null,
        subject: slot.subject,
        period: slot.period,
      }));
    })
    .sort((a, b) => a.name.localeCompare(b.name) || (a.className ?? '').localeCompare(b.className ?? ''));
}

export type SearchTab = 'students' | 'teachers' | 'timetables';
