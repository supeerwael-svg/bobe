import type { TimetableSlot } from '@/db/types';
import { slotKey } from '@/utils/timetableConflicts';
import { lessonsAt, type LessonEntry } from '@/utils/timetableLessons';

export interface SlotAvailability {
  occupiedRoomIds: string[];
  occupiedCount: number;
  freeRoomIds: string[];
  freeCount: number;
  lessons: LessonEntry[];
}

export function buildRoomAvailability(
  slots: TimetableSlot[],
  roomIds: string[],
  days: number[],
  periods: number[],
): Map<string, SlotAvailability> {
  const roomSet = new Set(roomIds);
  const result = new Map<string, SlotAvailability>();
  for (const day of days) {
    for (const period of periods) {
      const lessons = lessonsAt(slots, day, period);
      const occupied = new Set<string>();
      let withoutRoom = 0;
      for (const lesson of lessons) {
        if (lesson.roomId && roomSet.has(lesson.roomId)) occupied.add(lesson.roomId);
        else withoutRoom += 1;
      }
      const occupiedCount = occupied.size + withoutRoom;
      result.set(slotKey(day, period), {
        occupiedRoomIds: [...occupied],
        occupiedCount,
        freeRoomIds: roomIds.filter((id) => !occupied.has(id)),
        freeCount: Math.max(0, roomIds.length - occupiedCount),
        lessons,
      });
    }
  }
  return result;
}
