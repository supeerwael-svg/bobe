import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SyncRecord, SyncTable, SyncTransport, SyncStatus } from '@/utils/sync';

export class SupabaseTransport implements SyncTransport {
  private client: SupabaseClient;
  private currentStatus: SyncStatus = 'idle';

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async push(records: SyncRecord[], table: SyncTable): Promise<void> {
    this.currentStatus = 'pushing';
    const tableName = table;
    for (const record of records) {
      const { error } = await this.client.from(tableName).upsert(record);
      if (error) {
        this.currentStatus = 'error';
        throw new Error(`Push failed for ${tableName}: ${error.message}`);
      }
    }
    this.currentStatus = 'idle';
  }

  async pull(table: SyncTable, sinceUpdatedAt: string | null, institutionId: string): Promise<SyncRecord[]> {
    this.currentStatus = 'pulling';
    let query = this.client.from(table).select('*').eq('institutionId', institutionId);
    if (sinceUpdatedAt) query = query.gt('updatedAt', sinceUpdatedAt);
    const { data, error } = await query;
    if (error) {
      this.currentStatus = 'error';
      throw new Error(`Pull failed for ${table}: ${error.message}`);
    }
    this.currentStatus = 'idle';
    return (data ?? []) as SyncRecord[];
  }

  subscribe(table: SyncTable, institutionId: string, onChange: (records: SyncRecord[]) => void): () => void {
    const channel = this.client
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `institutionId=eq.${institutionId}` },
        () => {
          void this.pull(table, null, institutionId).then(onChange).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      this.client.removeChannel(channel);
    };
  }

  status(): SyncStatus {
    return this.currentStatus;
  }
}
