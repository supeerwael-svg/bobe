import { prepareStudentInput, studentIdentityKey, validateStudentInput } from '@/db/studentRules';
import { BOARDING_STATUSES, GENDERS, type BoardingStatus, type Gender, type SchoolClass, type Student, type StudentInput } from '@/db/types';
import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';
import { normalizeText } from '@/utils/text';
import { isIsoDate } from '@/utils/validation';

export const IMPORT_FIELDS = [
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'repeater',
  'boardingStatus',
  'className',
  'joinDate',
  'leaveDate',
  'cardCode',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ['firstName', 'lastName', 'gender', 'className'];

export type ColumnMapping = Partial<Record<ImportField, number>>;

export interface RowIssue {
  field: ImportField | null;
  key: string;
}

export interface PreviewRow {
  rowNumber: number;
  displayName: string;
  input: StudentInput | null;
  issues: RowIssue[];
}

const EXTRA_ALIASES: Record<ImportField, string[]> = {
  firstName: ['first', 'given name', 'fname'],
  lastName: ['last', 'surname', 'family name', 'lname'],
  gender: ['sex'],
  dateOfBirth: ['dob', 'birth date', 'birthdate', 'date of birth'],
  placeOfBirth: ['birth place', 'pob'],
  repeater: ['repeat', 'repeated'],
  boardingStatus: ['status', 'boarding'],
  className: ['class name', 'grade', 'group'],
  joinDate: ['join', 'enrolled', 'enrollment date'],
  leaveDate: ['leave', 'left', 'exit date'],
  cardCode: ['card code', 'barcode', 'card', 'كود البطاقة'],
};

export const IMPORT_ALIASES: Record<ImportField, string[]> = Object.fromEntries(
  IMPORT_FIELDS.map((field) => [field, [en.students.fields[field], ar.students.fields[field], ...EXTRA_ALIASES[field]]]),
) as Record<ImportField, string[]>;

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
}

export function detectMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const field of IMPORT_FIELDS) {
    const aliases = IMPORT_ALIASES[field].map(normalizeHeader);
    const index = normalized.findIndex((header, position) => !used.has(position) && header !== '' && aliases.includes(header));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value instanceof Date) return '';
  return String(value).trim();
}

const GENDER_TOKENS: Record<Gender, string[]> = {
  male: ['m', 'male', 'ذكر'],
  female: ['f', 'female', 'أنثى'],
};

function parseGender(text: string): Gender | null {
  const key = normalizeText(text);
  return GENDERS.find((gender) => GENDER_TOKENS[gender].some((token) => normalizeText(token) === key)) ?? null;
}

const BOARDING_TOKENS: Record<BoardingStatus, string[]> = {
  'half-boarder': ['half-boarder', 'half boarder', 'halfboarder', 'نصف داخلي'],
  external: ['external', 'خارجي'],
};

function parseBoarding(text: string): BoardingStatus | null {
  if (text === '') return 'external';
  const key = normalizeText(text);
  return BOARDING_STATUSES.find((status) => BOARDING_TOKENS[status].some((token) => normalizeText(token) === key)) ?? null;
}

const YES_TOKENS = ['yes', 'y', 'true', '1', 'نعم'];
const NO_TOKENS = ['no', 'n', 'false', '0', 'لا'];

function parseRepeater(text: string): boolean | null {
  if (text === '') return false;
  const key = normalizeText(text);
  if (YES_TOKENS.some((token) => normalizeText(token) === key)) return true;
  if (NO_TOKENS.some((token) => normalizeText(token) === key)) return false;
  return null;
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function isoFromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildIso(year: number, month: number, day: number): string | null {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

function parseDateCell(value: unknown): { value: string | null; valid: boolean } {
  const invalid = { value: null, valid: false };
  if (value instanceof Date) {
    const iso = isoFromDate(value);
    return iso ? { value: iso, valid: true } : invalid;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return invalid;
    const iso = isoFromDate(new Date(EXCEL_EPOCH_MS + value * 86_400_000));
    return iso ? { value: iso, valid: true } : invalid;
  }
  const text = cellText(value);
  if (text === '') return { value: null, valid: true };

  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  const iso = ymd
    ? buildIso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
    : dmy
      ? buildIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]))
      : null;
  return iso ? { value: iso, valid: true } : invalid;
}

interface BuildPreviewOptions {
  rows: unknown[][];
  mapping: ColumnMapping;
  classes: SchoolClass[];
  existing: Student[];
  today: string;
}

export function buildPreviewRows({ rows, mapping, classes, existing, today }: BuildPreviewOptions): PreviewRow[] {
  const existingKeys = new Set(existing.map(studentIdentityKey));
  const fileKeys = new Set<string>();
  const classByName = new Map(classes.map((schoolClass) => [normalizeText(schoolClass.name), schoolClass]));

  return rows.flatMap((cells, index) => {
    const read = (field: ImportField) => {
      const column = mapping[field];
      return column === undefined ? undefined : cells[column];
    };
    if (cells.every((cell) => cellText(cell) === '')) return [];

    const issues: RowIssue[] = [];
    const addIssue = (field: ImportField | null, key: string) => issues.push({ field, key });

    const firstName = cellText(read('firstName'));
    const lastName = cellText(read('lastName'));
    const genderText = cellText(read('gender'));
    const gender = parseGender(genderText);
    if (gender === null) addIssue('gender', genderText === '' ? 'validation.genderRequired' : 'validation.genderInvalid');

    const classText = cellText(read('className'));
    const schoolClass = classText === '' ? undefined : classByName.get(normalizeText(classText));
    if (!schoolClass) addIssue('className', classText === '' ? 'validation.classRequired' : 'validation.classNotFound');

    const boardingStatus = parseBoarding(cellText(read('boardingStatus')));
    if (boardingStatus === null) addIssue('boardingStatus', 'validation.boardingInvalid');

    const repeater = parseRepeater(cellText(read('repeater')));
    if (repeater === null) addIssue('repeater', 'validation.repeaterInvalid');

    const dateFields = ['dateOfBirth', 'joinDate', 'leaveDate'] as const;
    const dates = Object.fromEntries(
      dateFields.map((field) => {
        const parsed = parseDateCell(read(field));
        if (!parsed.valid) addIssue(field, 'validation.invalidDate');
        return [field, parsed.value];
      }),
    ) as Record<(typeof dateFields)[number], string | null>;

    const candidate: StudentInput = {
      firstName,
      lastName,
      gender: gender ?? ('' as Gender),
      dateOfBirth: dates.dateOfBirth,
      placeOfBirth: cellText(read('placeOfBirth')),
      repeater: repeater ?? false,
      boardingStatus: boardingStatus ?? 'external',
      classId: schoolClass?.id ?? '',
      joinDate: dates.joinDate,
      leaveDate: dates.leaveDate,
      cardCode: cellText(read('cardCode')) || null,
    };

    const reportedFields = new Set(issues.map((issue) => issue.field));
    for (const issue of validateStudentInput(candidate, today)) {
      const field: ImportField | null = issue.field === 'classId' ? 'className' : issue.field;
      if (field && !reportedFields.has(field)) addIssue(field, issue.key);
    }

    const displayName = `${firstName} ${lastName}`.trim();
    const rowNumber = index + 2;
    let input: StudentInput | null = null;

    if (issues.length === 0) {
      const prepared = prepareStudentInput(candidate);
      const key = studentIdentityKey(prepared);
      if (existingKeys.has(key)) {
        addIssue(null, 'validation.duplicateStudent');
      } else if (fileKeys.has(key)) {
        addIssue(null, 'validation.duplicateInFile');
      } else {
        fileKeys.add(key);
        input = prepared;
      }
    }

    return [{ rowNumber, displayName, input, issues }];
  });
}
