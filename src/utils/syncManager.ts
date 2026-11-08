import { db } from '@/db/database';
import { SYNC_TABLES, type SyncRecord, type SyncState, type SyncTable, type SyncTransport } from '@/utils/sync';

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
let transport: SyncTransport | null = null;
let flushInProgress = false;
let lastSyncedAt: string | null = null;

export function setSyncTransport(t: SyncTransport | null): void {
  transport = t;
}

export function getSyncState(): SyncState {
  return {
    status: transport?.status() ?? 'idle',
    lastSyncedAt,
    pendingCount: 0,
    error: null,
  };
}

export async function getPendingCount(): Promise<number> {
  return db.outbox.count();
}

export async function enqueueChange(tableName: SyncTable, record: SyncRecord): Promise<void> {
  await db.outbox.put({
    id: `${record.id}|${record.updatedAt}`,
    institutionId: record.institutionId,
    tableName,
    recordId: record.id,
    updatedAt: record.updatedAt,
    payload: JSON.stringify(record),
    retries: 0,
    createdAt: new Date().toISOString(),
  });
}

function backoffDelay(retries: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** retries, 60_000);
}

export async function flushOutbox(): Promise<void> {
  if (!transport || flushInProgress) return;
  flushInProgress = true;
  try {
    const entries = await db.outbox.orderBy('createdAt').toArray();
    const byTable = new Map<SyncTable, SyncRecord[]>();
    for (const entry of entries) {
      const table = entry.tableName as SyncTable;
      const records = byTable.get(table) ?? [];
      records.push(JSON.parse(entry.payload) as SyncRecord);
      byTable.set(table, records);
    }
    for (const [table, records] of byTable) {
      await transport.push(records, table);
      const ids = new Set(records.map((r) => r.id));
      await db.outbox.where('recordId').anyOf([...ids]).delete();
    }
    lastSyncedAt = new Date().toISOString();
  } catch {
    const failedEntries = await db.outbox.toArray();
    for (const entry of failedEntries) {
      if (entry.retries < MAX_RETRIES) {
        await db.outbox.update(entry.id, { retries: entry.retries + 1 });
      }
    }
    const oldestRetry = failedEntries[0];
    if (oldestRetry && oldestRetry.retries < MAX_RETRIES) {
      setTimeout(() => void flushOutbox(), backoffDelay(oldestRetry.retries));
    }
  } finally {
    flushInProgress = false;
  }
}

export async function pullAll(institutionId: string): Promise<void> {
  if (!transport) return;
  for (const table of Object.keys(SYNC_TABLES) as SyncTable[]) {
    const records = await transport.pull(table, lastSyncedAt, institutionId);
    if (records.length > 0) {
      const dexieTable = db[table as keyof typeof db] as { bulkPut: (items: unknown[]) => Promise<unknown> };
      await dexieTable.bulkPut(records);
    }
  }
  lastSyncedAt = new Date().toISOString();
}

export async function syncNow(institutionId: string): Promise<void> {
  await flushOutbox();
  await pullAll(institutionId);
}

export function onOnline(): void {
  void flushOutbox();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushOutbox());
}
