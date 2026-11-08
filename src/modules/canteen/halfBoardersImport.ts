import * as XLSX from 'xlsx';
import { normalizeText } from '@/utils/text';
import { isIsoDate } from '@/utils/validation';
import type { SchoolClass, Student, StudentInput } from '@/db/types';
import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';

export type HbField = 'firstName' | 'lastName' | 'dateOfBirth' | 'className' | 'cardCode';

export const HB_FIELDS: HbField[] = ['firstName', 'lastName', 'dateOfBirth', 'className', 'cardCode'];

export type HbColumnMapping = Partial<Record<HbField, number>>;

export interface HbRowIssue {
  field: HbField | null;
  key: string;
}

export type HbRowAction = 'new' | 'update' | 'error';

export interface HbPreviewRow {
  rowNumber: number;
  displayName: string;
  action: HbRowAction;
  input: StudentInput | null;
  matchedStudent: Student | null;
  issues: HbRowIssue[];
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function cellText(value: unknown): string {
  if (value === null || value === undefined || value instanceof Date) return '';
  return String(value).trim();
}

export function parseDateCell(value: unknown): { value: string | null; valid: boolean } {
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

  const ymdDash = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const dmyDash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(text);
  const dmySlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const ymdSlash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  const ymdDot = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(text);
  const dmyDot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);

  const m = ymdDash ?? ymdSlash ?? ymdDot;
  const dm = dmyDash ?? dmySlash ?? dmyDot;

  if (m) return buildResult(Number(m[1]), Number(m[2]), Number(m[3]));
  if (dm) return buildResult(Number(dm[3]), Number(dm[2]), Number(dm[1]));
  return invalid;
}

function isoFromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildResult(year: number, month: number, day: number): { value: string | null; valid: boolean } {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isIsoDate(iso) ? { value: iso, valid: true } : { value: null, valid: false };
}

const FIELD_ALIASES: Record<HbField, string[]> = {
  firstName: ['الاسم', 'الإسم', 'اسم', 'first name', 'first', 'given name', 'fname', 'prénom'],
  lastName: ['اللقب', 'النسب', 'لقب', 'last name', 'last', 'surname', 'family name', 'lname', 'nom'],
  dateOfBirth: ['تاريخ الميلاد', 'تاريخ الازدياد', 'الميلاد', 'birth date', 'birthdate', 'date of birth', 'dob', 'naissance'],
  className: ['القسم', 'الفوج', 'الفصل', 'الصف', 'class name', 'class', 'grade', 'group', 'classe'],
  cardCode: ['كود البطاقة', 'رقم البطاقة', 'البطاقة', 'barcode', 'card code', 'card', 'رقم البطاقة'],
};

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
}

export function detectHbMapping(headers: string[]): HbColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: HbColumnMapping = {};
  for (const field of HB_FIELDS) {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    const index = normalized.findIndex((header, position) => !used.has(position) && header !== '' && aliases.includes(header));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

function arNormalize(s: string): string {
  return normalizeText(s);
}

export function matchStudent(
  firstName: string,
  lastName: string,
  dateOfBirth: string | null,
  className: string | null,
  existing: Student[],
  classes: SchoolClass[],
): Student | null {
  const fn = arNormalize(firstName);
  const ln = arNormalize(lastName);
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const byNameAndDob = existing.filter((s) => {
    if (dateOfBirth === null) return false;
    return arNormalize(s.firstName) === fn && arNormalize(s.lastName) === ln && s.dateOfBirth === dateOfBirth;
  });
  if (byNameAndDob.length === 1) return byNameAndDob[0];
  if (byNameAndDob.length > 1) return null;

  if (dateOfBirth === null && className !== null) {
    const byNameAndClass = existing.filter((s) => {
      const sClassName = classNameById.get(s.classId) ?? '';
      return arNormalize(s.firstName) === fn && arNormalize(s.lastName) === ln && arNormalize(sClassName) === arNormalize(className);
    });
    if (byNameAndClass.length === 1) return byNameAndClass[0];
  }
  return null;
}

export interface HbPreviewOptions {
  rows: unknown[][];
  mapping: HbColumnMapping;
  classes: SchoolClass[];
  existing: Student[];
  today: string;
}

export function buildHbPreviewRows({ rows, mapping, classes, existing, today }: HbPreviewOptions): HbPreviewRow[] {
  const classByName = new Map(classes.map((c) => [normalizeText(c.name), c]));
  const fileCardCodes = new Set<string>();
  const existingCardCodes = new Set(existing.map((s) => s.cardCode?.trim()).filter(Boolean));

  return rows.flatMap((cells, index) => {
    const read = (field: HbField) => {
      const column = mapping[field];
      return column === undefined ? undefined : cells[column];
    };
    if (cells.every((cell) => cellText(cell) === '')) return [];

    const issues: HbRowIssue[] = [];
    const addIssue = (field: HbField | null, key: string) => issues.push({ field, key });

    const firstName = cellText(read('firstName'));
    const lastName = cellText(read('lastName'));
    const classText = cellText(read('className'));
    const cardCode = cellText(read('cardCode'));

    if (!firstName) addIssue('firstName', 'missingName');
    if (!lastName) addIssue('lastName', 'missingName');

    const dateResult = parseDateCell(read('dateOfBirth'));
    if (!dateResult.valid) addIssue('dateOfBirth', 'invalidDate');
    const dateOfBirth = dateResult.value;

    const schoolClass = classText === '' ? undefined : classByName.get(normalizeText(classText));
    if (classText !== '' && !schoolClass) addIssue('className', 'classNotFound');

    if (cardCode) {
      if (fileCardCodes.has(cardCode)) {
        addIssue('cardCode', 'duplicateInFile');
      } else if (existingCardCodes.has(cardCode)) {
        addIssue('cardCode', 'duplicateExisting');
      } else {
        fileCardCodes.add(cardCode);
      }
    }

    const displayName = `${firstName} ${lastName}`.trim();
    const rowNumber = index + 2;
    let matched: Student | null = null;

    if (firstName && lastName && issues.length === 0) {
      matched = matchStudent(firstName, lastName, dateOfBirth, classText, existing, classes);
    }

    let action: HbRowAction = 'error';
    let input: StudentInput | null = null;

    if (issues.length === 0) {
      if (matched) {
        action = 'update';
      } else {
        action = 'new';
        input = {
          firstName,
          lastName,
          gender: 'male',
          dateOfBirth,
          placeOfBirth: '',
          repeater: false,
          boardingStatus: 'half-boarder',
          classId: schoolClass?.id ?? '',
          joinDate: today,
          leaveDate: null,
          cardCode: cardCode || null,
        };
      }
    }

    return [{ rowNumber, displayName, action, input, matchedStudent: matched, issues }];
  });
}

export interface HbTemplateOptions {
  lang: 'en' | 'ar';
}

export function buildHalfBoarderTemplate(lang: 'en' | 'ar'): XLSX.WorkBook {
  const locale = lang === 'ar' ? ar : en;
  const headers = [
    locale.students.fields.firstName,
    locale.students.fields.lastName,
    locale.students.fields.dateOfBirth,
    locale.students.fields.className,
    locale.students.cardCode.label,
  ];
  const exampleRow = lang === 'ar'
    ? ['محمد', 'العربي', '15/03/2010', '1م1', '123456']
    : ['Ahmed', 'Ben Ali', '15/03/2010', '1M1', '123456'];

  const wb = XLSX.utils.book_new();
  const sheetData = [headers, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  for (let col = 0; col < headers.length; col++) {
    const addr = XLSX.utils.encode_cell({ r: 1, c: col });
    if (col === 4) {
      if (!ws['!cells']) ws['!cells'] = {};
      ws[addr] = { t: 's', v: exampleRow[col] };
    }
  }
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'نصف الداخليين' : 'Half-boarders');

  const instrTitle = lang === 'ar' ? 'تعليمات' : 'Instructions';
  const instructions = lang === 'ar'
    ? [
      ['العمود', 'الشرح'],
      [headers[0], 'اسم الطالب'],
      [headers[1], 'لقب الطالب'],
      [headers[2], 'تاريخ الميلاد بصيغة dd/mm/yyyy (يوم/شهر/سنة)'],
      [headers[3], 'اسم القسم كما هو مسجل في التطبيق'],
      [headers[4], 'رقم البطاقة (باركود) - يُقرأ كنص مع الحفاظ على الأصفار البادئة'],
    ]
    : [
      ['Column', 'Description'],
      [headers[0], 'Student first name'],
      [headers[1], 'Student last name'],
      [headers[2], 'Date of birth in dd/mm/yyyy format (day/month/year)'],
      [headers[3], 'Class name exactly as registered in the app'],
      [headers[4], 'Card code (barcode) - read as text, leading zeros preserved'],
    ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), instrTitle);

  return wb;
}

export function buildHalfBoarderExportRows(
  students: Student[],
  classes: SchoolClass[],
  lang: 'en' | 'ar',
): Record<string, string>[] {
  const locale = lang === 'ar' ? ar : en;
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  return students.map((s) => ({
    [locale.students.fields.firstName]: s.firstName,
    [locale.students.fields.lastName]: s.lastName,
    [locale.students.fields.dateOfBirth]: s.dateOfBirth ?? '',
    [locale.students.fields.className]: classNameById.get(s.classId) ?? '',
    [locale.students.cardCode.label]: s.cardCode ?? '',
  }));
}

export function buildErrorWorkbook(
  errors: { rowNumber: number; displayName: string; reason: string }[],
  lang: 'en' | 'ar',
): XLSX.WorkBook {
  const locale = lang === 'ar' ? ar : en;
  const headers = [
    lang === 'ar' ? 'الصف' : 'Row',
    lang === 'ar' ? 'الاسم' : 'Name',
    lang === 'ar' ? 'السبب' : 'Reason',
  ];
  const rows = errors.map((e) => [e.rowNumber, e.displayName, e.reason]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), lang === 'ar' ? 'الأخطاء' : 'Errors');
  return wb;
}
