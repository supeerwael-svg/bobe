import type { TimetableSlot } from '@/db/types';
import { slotLessons, type LessonEntry } from '@/utils/timetableLessons';

export interface TimetableConflict {
  kind: 'teacher' | 'room';
  day: number;
  period: number;
  resourceId: string;
  classIds: string[];
  entries: LessonEntry[];
}

export function slotKey(day: number, period: number): string {
  return `${day}-${period}`;
}

export function findTimetableConflicts(slots: TimetableSlot[]): TimetableConflict[] {
  const groups = new Map<string, TimetableConflict>();
  for (const slot of slots) {
    for (const lesson of slotLessons(slot)) {
      const entry: LessonEntry = {
        classId: slot.classId,
        day: slot.day,
        period: slot.period,
        groupNumber: lesson.groupNumber,
        subject: lesson.subject,
        teacherId: lesson.teacherId,
        roomId: lesson.roomId,
      };
      const resources = [
        { kind: 'teacher' as const, resourceId: lesson.teacherId },
        { kind: 'room' as const, resourceId: lesson.roomId },
      ];
      for (const { kind, resourceId } of resources) {
        if (!resourceId) continue;
        const key = `${kind}|${slot.day}|${slot.period}|${resourceId}`;
        const group =
          groups.get(key) ?? { kind, day: slot.day, period: slot.period, resourceId, classIds: [], entries: [] };
        group.entries.push(entry);
        if (!group.classIds.includes(slot.classId)) group.classIds.push(slot.classId);
        groups.set(key, group);
      }
    }
  }
  return [...groups.values()].filter((group) => group.entries.length > 1);
}
