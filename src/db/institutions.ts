import { DomainError } from '@/utils/errors';
import { db } from './database';
import { touchFields } from './records';
import { assertHeadActor } from './users';
import type { AbsenceCountRule, CanteenMatchField, Holiday, Institution } from './types';
import { generateInviteCode } from '@/utils/invite';

export const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4];

export async function getInstitution(institutionId: string): Promise<Institution> {
  const institution = await db.institutions.get(institutionId);
  if (!institution || institution.deletedAt !== null) {
    throw new DomainError('errors.notFound');
  }
  return institution;
}

export interface InstitutionSettingsInput {
  name: string;
  rooms: number;
  workingDays: number[];
  canteenDays: number[];
  holidays: Holiday[];
  directorate: string;
  city: string;
  reportNumberPrefix: string;
  absenceCountRule: AbsenceCountRule;
  canteenMatchField: CanteenMatchField;
  canteenTrackingStart: string | null;
}

export async function updateInstitutionSettings(
  institutionId: string,
  input: InstitutionSettingsInput,
  actorId: string,
): Promise<void> {
  await assertHeadActor(actorId);
  const institution = await getInstitution(institutionId);
  await db.institutions.put({
    ...institution,
    name: input.name.trim(),
    rooms: input.rooms,
    workingDays: [...input.workingDays].sort((a, b) => a - b),
    canteenDays: [...input.canteenDays].sort((a, b) => a - b),
    holidays: [...input.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    directorate: input.directorate.trim(),
    city: input.city.trim(),
    reportNumberPrefix: input.reportNumberPrefix.trim(),
    absenceCountRule: input.absenceCountRule,
    canteenMatchField: input.canteenMatchField,
    canteenTrackingStart: input.canteenTrackingStart || null,
    ...touchFields(actorId),
  });
}

export async function renewInviteCode(institutionId: string, actorId: string): Promise<string> {
  await assertHeadActor(actorId);
  const institution = await getInstitution(institutionId);
  const inviteCode = generateInviteCode();
  await db.institutions.put({ ...institution, inviteCode, ...touchFields(actorId) });
  return inviteCode;
}
