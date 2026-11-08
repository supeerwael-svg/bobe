import type { TimetableGroup, TimetableSlot } from '@/db/types';

export interface SlotLesson {
  groupNumber: number | null;
  subject: string;
  teacherId: string | null;
  roomId: string | null;
}

export interface LessonEntry extends SlotLesson {
  classId: string;
  day: number;
  period: number;
}

type SlotShape = Pick<TimetableSlot, 'subject' | 'teacherId'> & { roomId?: string | null; groups?: TimetableGroup[] };

export function isSplitSlot(slot: Pick<SlotShape, 'groups'>): boolean {
  return (slot.groups?.length ?? 0) >= 2;
}

export function slotLessons(slot: SlotShape): SlotLesson[] {
  if (isSplitSlot(slot)) {
    return (slot.groups ?? []).map((group) => ({
      groupNumber: group.groupNumber,
      subject: group.subject,
      teacherId: group.teacherId,
      roomId: group.roomId,
    }));
  }
  return [{ groupNumber: null, subject: slot.subject, teacherId: slot.teacherId, roomId: slot.roomId ?? null }];
}

export function unassignTeacherFromSlot<T extends SlotShape>(slot: T, teacherId: string, subject: string): T {
  if (isSplitSlot(slot)) {
    const groups = (slot.groups ?? []).map((group) =>
      group.teacherId === teacherId && group.subject === subject ? { ...group, teacherId: null } : group,
    );
    return { ...slot, groups, teacherId: groups[0].teacherId };
  }
  return slot.teacherId === teacherId && slot.subject === subject ? { ...slot, teacherId: null } : slot;
}

export function lessonsAt(slots: TimetableSlot[], day: number, period: number): LessonEntry[] {
  return slots
    .filter((slot) => slot.day === day && slot.period === period)
    .flatMap((slot) => slotLessons(slot).map((lesson) => ({ ...lesson, classId: slot.classId, day, period })));
}
