import { describe, it, expect } from 'vitest';
import {
  parseDateCell,
  detectHbMapping,
  matchStudent,
  buildHbPreviewRows,
  HB_FIELDS,
} from '@/modules/canteen/halfBoardersImport';
import type { SchoolClass, Student } from '@/db/types';

const T = '2026-11-08';

function makeClass(id: string, name: string): SchoolClass {
  return {
    id,
    institutionId: 'inst',
    createdAt: T,
    updatedAt: T,
    deletedAt: null,
    updatedBy: null,
    name,
    level: null,
  };
}

function makeStudent(id: string, firstName: string, lastName: string, dateOfBirth: string | null, classId: string, cardCode?: string): Student {
  return {
    id,
    institutionId: 'inst',
    createdAt: T,
    updatedAt: T,
    deletedAt: null,
    updatedBy: null,
    firstName,
    lastName,
    gender: 'male',
    dateOfBirth,
    placeOfBirth: '',
    repeater: false,
    boardingStatus: 'half-boarder',
    classId,
    joinDate: null,
    leaveDate: null,
    cardCode: cardCode ?? null,
  };
}

describe('parseDateCell', () => {
  it('parses dd/mm/yyyy', () => {
    expect(parseDateCell('15/03/2010')).toEqual({ value: '2010-03-15', valid: true });
  });

  it('parses d-m-yyyy', () => {
    expect(parseDateCell('5-3-2010')).toEqual({ value: '2010-03-05', valid: true });
  });

  it('parses yyyy-mm-dd', () => {
    expect(parseDateCell('2010-03-15')).toEqual({ value: '2010-03-15', valid: true });
  });

  it('parses Excel serial number', () => {
    expect(parseDateCell(40252)).toEqual({ value: '2010-03-15', valid: true });
  });

  it('parses Date object', () => {
    const d = new Date(Date.UTC(2010, 2, 15));
    expect(parseDateCell(d)).toEqual({ value: '2010-03-15', valid: true });
  });

  it('returns invalid for bad text', () => {
    expect(parseDateCell('not-a-date')).toEqual({ value: null, valid: false });
  });

  it('returns valid null for empty string', () => {
    expect(parseDateCell('')).toEqual({ value: null, valid: true });
  });
});

describe('detectHbMapping', () => {
  it('detects Arabic headers', () => {
    const headers = ['الاسم', 'اللقب', 'تاريخ الميلاد', 'القسم', 'كود البطاقة'];
    const mapping = detectHbMapping(headers);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.dateOfBirth).toBe(2);
    expect(mapping.className).toBe(3);
    expect(mapping.cardCode).toBe(4);
  });

  it('detects English headers', () => {
    const headers = ['First name', 'Last name', 'Date of birth', 'Class name', 'Card code'];
    const mapping = detectHbMapping(headers);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.dateOfBirth).toBe(2);
    expect(mapping.className).toBe(3);
    expect(mapping.cardCode).toBe(4);
  });

  it('detects variant aliases', () => {
    const headers = ['الإسم', 'النسب', 'تاريخ الازدياد', 'الفوج', 'رقم البطاقة'];
    const mapping = detectHbMapping(headers);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.dateOfBirth).toBe(2);
    expect(mapping.className).toBe(3);
    expect(mapping.cardCode).toBe(4);
  });

  it('detects English aliases', () => {
    const headers = ['first', 'surname', 'dob', 'grade', 'barcode'];
    const mapping = detectHbMapping(headers);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.dateOfBirth).toBe(2);
    expect(mapping.className).toBe(3);
    expect(mapping.cardCode).toBe(4);
  });
});

describe('matchStudent', () => {
  const classes = [makeClass('c1', '1م1'), makeClass('c2', '2م1')];
  const existing = [
    makeStudent('s1', 'محمد', 'العربي', '2010-03-15', 'c1'),
    makeStudent('s2', 'أحمد', 'بن علي', '2009-01-10', 'c2', '123456'),
  ];

  it('matches by name and birth date', () => {
    expect(matchStudent('محمد', 'العربي', '2010-03-15', null, existing, classes)?.id).toBe('s1');
  });

  it('matches with Arabic normalization (أ vs ا)', () => {
    expect(matchStudent('احمد', 'بن علي', '2009-01-10', null, existing, classes)?.id).toBe('s2');
  });

  it('matches by name and class when no birth date', () => {
    expect(matchStudent('محمد', 'العربي', null, '1م1', existing, classes)?.id).toBe('s1');
  });

  it('returns null when no match', () => {
    expect(matchStudent('غير', 'موجود', '2010-03-15', null, existing, classes)).toBeNull();
  });
});

describe('buildHbPreviewRows', () => {
  const classes = [makeClass('c1', '1م1')];
  const existing = [makeStudent('s1', 'محمد', 'العربي', '2010-03-15', 'c1', '111')];
  const mapping = { firstName: 0, lastName: 1, dateOfBirth: 2, className: 3, cardCode: 4 };

  it('marks matched student as update', () => {
    const rows = buildHbPreviewRows({
      rows: [['محمد', 'العربي', '15/03/2010', '1م1', '222']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('update');
    expect(rows[0].matchedStudent?.id).toBe('s1');
  });

  it('marks unmatched student as new', () => {
    const rows = buildHbPreviewRows({
      rows: [['سامي', 'جديد', '15/03/2011', '1م1', '333']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('new');
    expect(rows[0].input).not.toBeNull();
    expect(rows[0].input?.boardingStatus).toBe('half-boarder');
  });

  it('reports error for missing name', () => {
    const rows = buildHbPreviewRows({
      rows: [['', 'العربي', '15/03/2010', '1م1', '444']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows[0].action).toBe('error');
    expect(rows[0].issues.some((i) => i.key === 'missingName')).toBe(true);
  });

  it('reports error for class not found', () => {
    const rows = buildHbPreviewRows({
      rows: [['سامي', 'جديد', '15/03/2011', 'غير موجود', '555']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows[0].action).toBe('error');
    expect(rows[0].issues.some((i) => i.key === 'classNotFound')).toBe(true);
  });

  it('reports error for duplicate card code in file', () => {
    const rows = buildHbPreviewRows({
      rows: [
        ['سامي', 'جديد', '15/03/2011', '1م1', '999'],
        ['علي', 'جديد2', '15/03/2011', '1م1', '999'],
      ],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows[1].issues.some((i) => i.key === 'duplicateInFile')).toBe(true);
  });

  it('reports error for duplicate card code already used by another student', () => {
    const rows = buildHbPreviewRows({
      rows: [['سامي', 'جديد', '15/03/2011', '1م1', '111']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows[0].issues.some((i) => i.key === 'duplicateExisting')).toBe(true);
  });

  it('preserves leading zeros in card code', () => {
    const rows = buildHbPreviewRows({
      rows: [['سامي', 'جديد', '15/03/2011', '1م1', '007']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows[0].input?.cardCode).toBe('007');
  });

  it('skips empty rows', () => {
    const rows = buildHbPreviewRows({
      rows: [['', '', '', '', '']],
      mapping,
      classes,
      existing,
      today: T,
    });
    expect(rows).toHaveLength(0);
  });
});
