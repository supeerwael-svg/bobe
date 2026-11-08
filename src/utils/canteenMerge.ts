import type { CanteenEntry } from '@/db/types';
import { entryKey } from './canteenPeriod';

export const CANTEEN_EXPORT_FORMAT = 'canteen-entries';
export const CANTEEN_EXPORT_VERSION = 1;

export interface CanteenExportFile {
  format: typeof CANTEEN_EXPORT_FORMAT;
  version: typeof CANTEEN_EXPORT_VERSION;
  institutionId: string;
  exportedAt: string;
  entries: CanteenEntry[];
}

export function buildCanteenExport(institutionId: string, entries: CanteenEntry[], exportedAt: string): CanteenExportFile {
  return {
    format: CANTEEN_EXPORT_FORMAT,
    version: CANTEEN_EXPORT_VERSION,
    institutionId,
    exportedAt,
    entries: entries.filter((entry) => entry.deletedAt === null),
  };
}

export function parseCanteenExport(text: string, institutionId: string): CanteenEntry[] {
  const data = JSON.parse(text) as Partial<CanteenExportFile>;
  if (
    data.format !== CANTEEN_EXPORT_FORMAT ||
    data.version !== CANTEEN_EXPORT_VERSION ||
    data.institutionId !== institutionId ||
    !Array.isArray(data.entries)
  ) {
    throw new Error('invalid canteen export');
  }
  return data.entries;
}

function compareEarliest(a: CanteenEntry, b: CanteenEntry): number {
  if (a.time !== b.time) return a.time.localeCompare(b.time);
  return a.id.localeCompare(b.id);
}

export function planCanteenMerge(existing: CanteenEntry[], incoming: CanteenEntry[], updatedAt: string): CanteenEntry[] {
  const existingIds = new Set(existing.map((entry) => entry.id));
  const liveExisting = existing.filter((entry) => entry.deletedAt === null);
  const newcomers = incoming.filter((entry) => entry.deletedAt === null && !existingIds.has(entry.id));

  const pool = new Map<string, CanteenEntry[]>();
  for (const entry of [...liveExisting, ...newcomers]) {
    if (entry.result !== 'accepted' || entry.studentId === null) continue;
    const key = entryKey(entry.studentId, entry.date);
    pool.set(key, [...(pool.get(key) ?? []), entry]);
  }

  const changed = new Map<string, CanteenEntry>();
  for (const group of pool.values()) {
    if (group.length < 2) continue;
    const [, ...later] = [...group].sort(compareEarliest);
    for (const entry of later) {
      changed.set(entry.id, { ...entry, result: 'rejected', reason: 'duplicate', updatedAt });
    }
  }

  const toWrite = [
    ...newcomers.map((entry) => changed.get(entry.id) ?? entry),
    ...liveExisting.filter((entry) => changed.has(entry.id)).map((entry) => changed.get(entry.id) as CanteenEntry),
  ];
  return toWrite;
}
