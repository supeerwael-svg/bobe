import { describe, expect, it } from 'vitest';
import { detectDayAxis, normalizeName, parseCellContent, parseDayLabel, parsePeriodLabel } from '@/utils/timetableParsing';

describe('normalizeName', () => {
  it('ignores case, spacing, Arabic diacritics and letter variants', () => {
    expect(normalizeName('  Ahmed   Ali ')).toBe(normalizeName('ahmed ali'));
    expect(normalizeName('أحمد')).toBe(normalizeName('احمد'));
    expect(normalizeName('مُحَمَّد')).toBe(normalizeName('محمد'));
    expect(normalizeName('مدرسة')).toBe(normalizeName('مدرسه'));
  });
});

describe('parseDayLabel', () => {
  it.each([
    ['Sunday', 0],
    ['mon', 1],
    ['Mardi', 2],
    ['الأربعاء', 3],
    ['jeudi', 4],
    ['الجمعة', 5],
    ['Samedi', 6],
  ])('parses %s', (text, day) => {
    expect(parseDayLabel(text)).toBe(day);
  });

  it('returns null for unknown labels', () => {
    expect(parseDayLabel('Period 1')).toBeNull();
    expect(parseDayLabel('')).toBeNull();
  });
});

describe('parsePeriodLabel', () => {
  it.each([
    ['1', 1],
    ['H4', 4],
    ['Period 7', 7],
    ['الحصة 3', 3],
    ['08:00-09:00', 1],
    ['9:00 - 10:00', 2],
    ['13:00', 5],
  ])('parses %s', (text, period) => {
    expect(parsePeriodLabel(text)).toBe(period);
  });

  it('rejects the lunch hour and out-of-range numbers', () => {
    expect(parsePeriodLabel('12:00-13:00')).toBeNull();
    expect(parsePeriodLabel('8')).toBeNull();
    expect(parsePeriodLabel('Recreation')).toBeNull();
  });
});

describe('parseCellContent', () => {
  it('splits subject, teacher and room with dashes', () => {
    expect(parseCellContent('Math - Ahmed Ali - 12')).toMatchObject({ subject: 'Math', teacher: 'Ahmed Ali', room: '12' });
  });

  it('accepts newlines, slashes and parentheses', () => {
    expect(parseCellContent('Physics\nKarim\nLab 2')).toMatchObject({ subject: 'Physics', teacher: 'Karim', room: 'Lab 2' });
    expect(parseCellContent('Arabic / Fatima / 7')).toMatchObject({ subject: 'Arabic', teacher: 'Fatima', room: '7' });
    expect(parseCellContent('History (Youssef) 4')).toMatchObject({ subject: 'History', teacher: 'Youssef', room: '4' });
  });

  it('keeps a subject-only cell and reports extra parts', () => {
    expect(parseCellContent('Sport')).toEqual({ subject: 'Sport', teacher: '', room: '', extraParts: 0 });
    expect(parseCellContent('A - B - C - D').extraParts).toBe(1);
  });
});

describe('detectDayAxis', () => {
  it('finds days across the header row (periods down the side)', () => {
    const grid = [
      ['Period', 'Sunday', 'Monday', 'Tuesday'],
      ['1', 'Math', 'Arabic', 'Art'],
      ['2', 'Science', 'French', 'Math'],
    ];
    expect(detectDayAxis(grid)).toBe('columns');
  });

  it('finds days down the first column (periods across the top)', () => {
    const grid = [
      ['', 'H1', 'H2', 'H3'],
      ['الأحد', 'Math', 'Arabic', 'Art'],
      ['الاثنين', 'Science', 'French', 'Math'],
      ['الثلاثاء', 'Sport', 'Math', 'Music'],
    ];
    expect(detectDayAxis(grid)).toBe('rows');
  });

  it('skips a title row and merged or empty cells', () => {
    const grid = [
      ['Timetable 2026', '', '', ''],
      [undefined, 'Lundi', 'Mardi', ''],
      ['1', 'Maths', '', 'Histoire'],
    ];
    expect(detectDayAxis(grid)).toBe('columns');
  });

  it('returns null when no day labels are present', () => {
    expect(detectDayAxis([['1', '2'], ['Math', 'Art']])).toBeNull();
  });
});
