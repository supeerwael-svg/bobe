import { normalizeText } from '@/utils/text';
import { todayIso } from '@/utils/dates';
import { isIsoDate, maxLengthKey, requiredKey } from '@/utils/validation';
import { BOARDING_STATUSES, GENDERS, type StudentInput } from './types';

export const TEXT_MAX_LENGTH = 60;

export interface FieldIssue {
  field: keyof StudentInput;
  key: string;
}

export function prepareStudentInput(input: StudentInput): StudentInput {
  return {
    ...input,
    firstName: input.firstName.trim().replace(/\s+/g, ' '),
    lastName: input.lastName.trim().replace(/\s+/g, ' '),
    placeOfBirth: input.placeOfBirth.trim().replace(/\s+/g, ' '),
    cardCode: input.cardCode?.trim() || null,
  };
}

export function validateStudentInput(input: StudentInput, today: string = todayIso()): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const add = (field: keyof StudentInput, key: string | null) => {
    if (key) issues.push({ field, key });
  };

  add('firstName', requiredKey(input.firstName) ?? maxLengthKey(input.firstName, TEXT_MAX_LENGTH, 'validation.textTooLong'));
  add('lastName', requiredKey(input.lastName) ?? maxLengthKey(input.lastName, TEXT_MAX_LENGTH, 'validation.textTooLong'));
  add('placeOfBirth', maxLengthKey(input.placeOfBirth, TEXT_MAX_LENGTH, 'validation.textTooLong'));
  add('gender', (GENDERS as readonly string[]).includes(input.gender) ? null : 'validation.genderRequired');
  add('boardingStatus', (BOARDING_STATUSES as readonly string[]).includes(input.boardingStatus) ? null : 'validation.boardingInvalid');
  add('classId', input.classId ? null : 'validation.classRequired');

  if (input.dateOfBirth !== null) {
    if (!isIsoDate(input.dateOfBirth)) add('dateOfBirth', 'validation.invalidDate');
    else if (input.dateOfBirth > today) add('dateOfBirth', 'validation.birthDateFuture');
  }

  if (input.joinDate !== null && !isIsoDate(input.joinDate)) {
    add('joinDate', 'validation.invalidDate');
  }

  if (input.leaveDate !== null) {
    if (!isIsoDate(input.leaveDate)) add('leaveDate', 'validation.invalidDate');
    else if (input.joinDate !== null && input.leaveDate < input.joinDate) add('leaveDate', 'validation.leaveBeforeJoin');
  }

  return issues;
}

export function studentIdentityKey(student: Pick<StudentInput, 'firstName' | 'lastName' | 'dateOfBirth' | 'classId'>): string {
  const birth = student.dateOfBirth ?? `class:${student.classId}`;
  return [normalizeText(student.firstName), normalizeText(student.lastName), birth].join('|');
}
