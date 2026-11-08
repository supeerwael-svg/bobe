import { describe, expect, it } from 'vitest';
import type { CanteenEntry } from '../db/types';
import { buildCanteenExport, parseCanteenExport, planCanteenMerge } from './canteenMerge';

function entry(id: string, studentId: string, time: string, overrides: Partial<CanteenEntry> = {}): CanteenEntry {
  return {
    id,
    institutionId: 'inst',
    studentId,
    scannedCode: 'code',
    date: '2026-11-02',
    time,
    result: 'accepted',
    reason: null,
    manual: false,
    supervisorId: 'u',
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  } as CanteenEntry;
}

describe('planCanteenMerge', () => {
  it('writes incoming entries that do not duplicate anything', () => {
    const plan = planCanteenMerge([], [entry('a', 's1', '12:00')], 'now');
    expect(plan.map((e) => e.id)).toEqual(['a']);
    expect(plan[0].result).toBe('accepted');
  });

  it('keeps the earliest accepted entry and marks a later incoming one as duplicate', () => {
    const existing = [entry('a', 's1', '11:00')];
    const plan = planCanteenMerge(existing, [entry('b', 's1', '12:00')], 'now');
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'b', result: 'rejected', reason: 'duplicate', updatedAt: 'now' });
  });

  it('marks a later existing entry as duplicate when an earlier incoming entry arrives', () => {
    const existing = [entry('a', 's1', '12:00')];
    const plan = planCanteenMerge(existing, [entry('b', 's1', '11:00')], 'now');
    const later = plan.find((e) => e.id === 'a');
    const kept = plan.find((e) => e.id === 'b');
    expect(later).toMatchObject({ result: 'rejected', reason: 'duplicate' });
    expect(kept?.result).toBe('accepted');
  });

  it('skips entries already present by id', () => {
    const existing = [entry('a', 's1', '11:00')];
    expect(planCanteenMerge(existing, [entry('a', 's1', '11:00')], 'now')).toEqual([]);
  });

  it('does not deduplicate different students or dates', () => {
    const plan = planCanteenMerge([entry('a', 's1', '11:00')], [entry('b', 's2', '11:00'), entry('c', 's1', '11:00', { date: '2026-11-03' })], 'now');
    expect(plan.every((e) => e.result === 'accepted')).toBe(true);
  });
});

describe('canteen export file', () => {
  it('round-trips entries for the same institution', () => {
    const file = buildCanteenExport('inst', [entry('a', 's1', '11:00')], 'now');
    expect(parseCanteenExport(JSON.stringify(file), 'inst')).toHaveLength(1);
  });

  it('rejects files from another institution or of another format', () => {
    const file = buildCanteenExport('inst', [], 'now');
    expect(() => parseCanteenExport(JSON.stringify(file), 'other')).toThrow();
    expect(() => parseCanteenExport('{"format":"x"}', 'inst')).toThrow();
  });
});
