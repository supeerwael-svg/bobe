import type { BaseRecord } from './types';

export function newBaseFields(institutionId: string, actorId: string | null, id: string = crypto.randomUUID()): BaseRecord {
  const now = new Date().toISOString();
  return { id, institutionId, createdAt: now, updatedAt: now, deletedAt: null, updatedBy: actorId };
}

export function touchFields(actorId: string): { updatedAt: string; updatedBy: string } {
  return { updatedAt: new Date().toISOString(), updatedBy: actorId };
}
