import { db } from './database';
import { assertHeadActor } from './users';
import type { DailyReportRecord, ParentCorrespondenceRow, SupervisorAbsenceRow } from './types';

export type DailyReportInput = {
  reportNumber: string;
  schoolYear: string;
  parentRows: ParentCorrespondenceRow[];
  counselorNotes: string;
  observationsActions: string;
  canteenNote: string;
  supervisorRows: SupervisorAbsenceRow[];
  teacherNotes: Record<string, string>;
};

export function dailyReportId(institutionId: string, date: string): string {
  return `${institutionId}|${date}`;
}

export function loadDailyReport(institutionId: string, date: string): Promise<DailyReportRecord | undefined> {
  return db.dailyReports.get(dailyReportId(institutionId, date));
}

export async function saveDailyReport(
  institutionId: string,
  date: string,
  input: DailyReportInput,
  actorId: string,
): Promise<void> {
  await assertHeadActor(actorId);
  await db.dailyReports.put({
    ...input,
    id: dailyReportId(institutionId, date),
    institutionId,
    date,
    updatedAt: new Date().toISOString(),
  });
}
