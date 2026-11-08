import { DomainError } from '@/utils/errors';
import { normalizeText } from '@/utils/text';
import { slotLessons } from '@/utils/timetableLessons';
import { db } from './database';
import { newBaseFields, touchFields } from './records';
import { TEXT_MAX_LENGTH } from './studentRules';
import { assertHeadActor } from './users';
import type { Room } from './types';

export async function listRooms(institutionId: string): Promise<Room[]> {
  const rooms = await db.rooms.where('institutionId').equals(institutionId).toArray();
  return rooms
    .filter((room) => room.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function createRoom(institutionId: string, rawName: string, actorId: string): Promise<Room> {
  await assertHeadActor(actorId);
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (name === '') throw new DomainError('validation.required');
  if (name.length > TEXT_MAX_LENGTH) throw new DomainError('validation.textTooLong');
  const key = normalizeText(name);
  const rooms = await listRooms(institutionId);
  if (rooms.some((room) => normalizeText(room.name) === key)) throw new DomainError('validation.roomDuplicate');
  const record: Room = { ...newBaseFields(institutionId, actorId), name };
  await db.rooms.add(record);
  return record;
}

export async function restoreRoom(roomId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const room = await db.rooms.get(roomId);
  if (!room) throw new DomainError('rooms.errors.notFound');
  const key = normalizeText(room.name);
  const rooms = await listRooms(room.institutionId);
  if (rooms.some((item) => item.id !== roomId && normalizeText(item.name) === key)) {
    throw new DomainError('validation.roomDuplicate');
  }
  await db.rooms.put({ ...room, deletedAt: null, ...touchFields(actorId) });
}

export async function deleteRoom(roomId: string, actorId: string): Promise<void> {
  await assertHeadActor(actorId);
  const room = await db.rooms.get(roomId);
  if (!room || room.deletedAt !== null) throw new DomainError('rooms.errors.notFound');
  const inUse = await db.timetableSlots
    .where('institutionId')
    .equals(room.institutionId)
    .filter((slot) => slot.deletedAt === null && slotLessons(slot).some((lesson) => lesson.roomId === roomId))
    .count();
  if (inUse > 0) throw new DomainError('rooms.errors.inUse');
  await db.rooms.put({ ...room, deletedAt: new Date().toISOString(), ...touchFields(actorId) });
}
