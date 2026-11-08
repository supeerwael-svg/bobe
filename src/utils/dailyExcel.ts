import * as XLSX from 'xlsx';
import type { ParentCorrespondenceRow } from '@/db/types';
import type { StudentDayAbsence } from '@/utils/dailyPage1';
import { formatPeriods } from '@/utils/dailyPage1';
import { BOARDING_LABELS, WHOLE_BLOCK_SIZE, footerText, formatDate, type Page1Render } from '@/utils/dailyPageHtml';
import { CANTEEN_SOURCE_LABELS, COUNT_RULE_LABELS, GAP_AFTER_PERIOD, REASON_LABELS, LEVEL_CLASSES_PER_ROW, SUPERVISOR_LABELS, SUPERVISOR_MIN_ROWS, TEACHER_MIN_ROWS, type Page2Render } from '@/utils/dailyPage2Html';
import { absenceRate, formatRate } from '@/utils/dailyReportStats';
import { saveWorkbook } from '@/utils/spreadsheet';

const COLUMN_COUNT = 12;
const HALF_BLOCK = WHOLE_BLOCK_SIZE / 2;
const PARENT_MIN_ROWS = 10;
const COLUMN_WIDTHS = [6, 14, 14, 10, 12, 14, 6, 14, 14, 10, 12, 14].map((wch) => ({ wch }));

const WHOLE_HEADER = ['الرقم', 'اللقب و الاسم', '', 'القسم', 'الصفة', 'تاريخ الغياب'];
const PARENT_HEADER = ['الرقم', 'اللقب و الاسم', '', 'القسم', 'ساعات', 'تاريخ الغياب', '', 'الأسباب', 'اشعار اول', 'اشعار ثاني', 'اعذار', 'تاريخ الشطب'];

type Cell = string | number;

class SheetBuilder {
  readonly rows: Cell[][] = [];
  readonly merges: XLSX.Range[] = [];

  constructor(private readonly columns: number) {}

  push(cells: Cell[]): number {
    this.rows.push([...cells, ...Array<Cell>(this.columns - cells.length).fill('')]);
    return this.rows.length - 1;
  }

  fullWidth(text: Cell): void {
    const row = this.push([text]);
    this.merge(row, 0, this.columns - 1);
  }

  vertical(col: number, startRow: number, endRow: number): void {
    this.merges.push({ s: { r: startRow, c: col }, e: { r: endRow, c: col } });
  }

  merge(row: number, startCol: number, endCol: number): void {
    this.merges.push({ s: { r: row, c: startCol }, e: { r: row, c: endCol } });
  }
}

function wholeCells(item: StudentDayAbsence | undefined, number: number): Cell[] {
  if (!item) return [number, '', '', '', '', ''];
  return [number, item.name, '', item.className, BOARDING_LABELS[item.boarding], formatDate(item.since)];
}

function addWholeDayBlocks(sheet: SheetBuilder, items: StudentDayAbsence[]): void {
  const blockCount = Math.max(1, Math.ceil(items.length / WHOLE_BLOCK_SIZE));
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * WHOLE_BLOCK_SIZE;
    const header = sheet.push([...WHOLE_HEADER, ...WHOLE_HEADER]);
    sheet.merge(header, 1, 2);
    sheet.merge(header, 7, 8);
    for (let row = 0; row < HALF_BLOCK; row += 1) {
      const left = start + row;
      const right = start + HALF_BLOCK + row;
      const index = sheet.push([
        ...wholeCells(items[left], left + 1),
        ...wholeCells(items[right], right + 1),
      ]);
      sheet.merge(index, 1, 2);
      sheet.merge(index, 7, 8);
    }
  }
}

function parentCells(row: ParentCorrespondenceRow | undefined, number: number): Cell[] {
  if (!row) return [number, '', '', '', '', '', '', '', '', '', '', ''];
  return [
    number,
    row.name,
    '',
    row.className,
    row.hours,
    formatDate(row.absenceDate),
    '',
    row.reason,
    row.firstNotice,
    row.secondNotice,
    row.excuse,
    formatDate(row.struckDate),
  ];
}

function addParentRows(sheet: SheetBuilder, rows: ParentCorrespondenceRow[]): void {
  const head = sheet.push(PARENT_HEADER);
  sheet.merge(head, 1, 2);
  sheet.merge(head, 5, 6);
  const total = Math.max(PARENT_MIN_ROWS, rows.length);
  for (let index = 0; index < total; index += 1) {
    const row = sheet.push(parentCells(rows[index], index + 1));
    sheet.merge(row, 1, 2);
    sheet.merge(row, 5, 6);
  }
}

export function buildPage1Sheet(render: Page1Render): XLSX.WorkSheet {
  const sheet = new SheetBuilder(COLUMN_COUNT);
  sheet.fullWidth('التلاميذ الغائبون إلى نهاية اليوم : (يسجل التلاميذ المتغيبين لمدة يوم أو أكثر فقط)');
  addWholeDayBlocks(sheet, render.wholeDay);

  sheet.fullWidth('التلاميذ الغائبون لبعض الحصص');
  if (render.partial.length === 0) sheet.fullWidth('');
  for (const item of render.partial) {
    sheet.fullWidth(`${item.name} - ${item.className} - ${formatPeriods(item.periods)}`);
  }

  sheet.fullWidth('مراسلات أولياء التلاميذ');
  addParentRows(sheet, render.parentRows);

  sheet.fullWidth('المستشار(ة) التربوي(ة)');
  sheet.fullWidth(render.counselorNotes);
  sheet.push(['', '', '', '', '', '', '', '', '', '', '', 'الإمضاء :']);

  sheet.fullWidth('مدير(ة) المؤسسة');
  sheet.fullWidth('');
  sheet.push(['', '', '', '', '', '', '', '', '', '', '', 'الإمضاء :']);


  const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
  worksheet['!merges'] = sheet.merges;
  worksheet['!cols'] = COLUMN_WIDTHS;
  return worksheet;
}

type Part = [Cell, number];

const part = (value: Cell, width = 1): Part => [value, width];

function spanRow(sheet: SheetBuilder, parts: Part[]): number {
  const cells = parts.flatMap(([value, width]) => [value, ...Array<Cell>(width - 1).fill('')]);
  const row = sheet.push(cells);
  let start = 0;
  for (const [, width] of parts) {
    if (width > 1) sheet.merge(row, start, start + width - 1);
    start += width;
  }
  return row;
}

const PAGE2_COLUMNS = 16;
const PERIOD_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

function addPage2Teachers(sheet: SheetBuilder, render: Page2Render): void {
  const periods = render.computed.periods;
  const header = (period: number) => part(periods.includes(period) ? `الحصة ${period}` : '');
  spanRow(sheet, [
    part('الرقم'),
    part('اللقب والاسم', 2),
    part('المادة'),
    ...PERIOD_SLOTS.slice(0, GAP_AFTER_PERIOD).map(header),
    part(''),
    ...PERIOD_SLOTS.slice(GAP_AFTER_PERIOD).map(header),
    part('ملاحظات', 3),
  ]);
  const lines = render.computed.teacherLines;
  const rowCount = Math.max(TEACHER_MIN_ROWS, lines.length);
  for (let index = 0; index < rowCount; index += 1) {
    const line = lines[index];
    const mark = (period: number) => part(line?.classByPeriod[period] ?? '');
    const note = line
      ? [line.reason ? REASON_LABELS[line.reason] : '', line.reasonNote, line.note].filter(Boolean).join(' - ')
      : '';
    spanRow(sheet, [
      part(index + 1),
      part(line?.name ?? '', 2),
      part(line?.subjects ?? ''),
      ...PERIOD_SLOTS.slice(0, GAP_AFTER_PERIOD).map(mark),
      part(''),
      ...PERIOD_SLOTS.slice(GAP_AFTER_PERIOD).map(mark),
      part(note, 3),
    ]);
  }
}

function addPage2Levels(sheet: SheetBuilder, render: Page2Render): void {
  const blanks = (count: number) => Array.from({ length: count }, () => part(''));
  spanRow(sheet, [part(''), ...blanks(LEVEL_CLASSES_PER_ROW), part('تلاميذ'), part('الغائبون'), part('نسبة الغياب')]);
  for (const level of render.computed.levels) {
    const pairs = Math.max(1, Math.ceil(level.classes.length / LEVEL_CLASSES_PER_ROW));
    const first = sheet.rows.length;
    for (let pair = 0; pair < pairs; pair += 1) {
      const slice = level.classes.slice(pair * LEVEL_CLASSES_PER_ROW, (pair + 1) * LEVEL_CLASSES_PER_ROW);
      const names = Array.from({ length: LEVEL_CLASSES_PER_ROW }, (_, index) => part(slice[index]?.className ?? ''));
      const counts = Array.from({ length: LEVEL_CLASSES_PER_ROW }, (_, index) => part(slice[index] ? slice[index].absent : ''));
      const isFirst = pair === 0;
      spanRow(sheet, [
        part(isFirst ? `الأقسام السنة ${level.level}` : ''),
        ...names,
        part(isFirst ? level.enrolled : ''),
        part(isFirst ? level.absent : ''),
        part(isFirst ? formatRate(level.rate) : ''),
      ]);
      spanRow(sheet, [part('عدد الغائبين'), ...counts, ...blanks(3)]);
    }
    for (const col of [LEVEL_CLASSES_PER_ROW + 1, LEVEL_CLASSES_PER_ROW + 2, LEVEL_CLASSES_PER_ROW + 3]) {
      sheet.vertical(col, first, first + 2 * pairs - 1);
    }
  }
  const enrolled = render.computed.levels.reduce((sum, level) => sum + level.enrolled, 0);
  const absent = render.computed.levels.reduce((sum, level) => sum + level.absent, 0);
  spanRow(sheet, [part('مجموع'), part('', LEVEL_CLASSES_PER_ROW), part(enrolled), part(absent), part(formatRate(absenceRate(absent, enrolled)))]);
}

function addPage2Supervisors(sheet: SheetBuilder, render: Page2Render): void {
  spanRow(sheet, [part('الرقم'), part('اسم المشرف التربوي', 5), part('صباحا', 2), part('مساءا', 2), part('الملاحظات', 6)]);
  const count = Math.max(SUPERVISOR_MIN_ROWS, render.supervisorRows.length);
  for (let index = 0; index < count; index += 1) {
    const row = render.supervisorRows[index];
    spanRow(sheet, [
      part(index + 1),
      part(row?.name ?? '', 5),
      part(row ? SUPERVISOR_LABELS[row.morning] : '', 2),
      part(row ? SUPERVISOR_LABELS[row.evening] : '', 2),
      part(row?.notes ?? '', 6),
    ]);
  }
}

function addPage2Summary(sheet: SheetBuilder, render: Page2Render): void {
  const { students, teachers, supervisors } = render.computed.summary;
  spanRow(sheet, [part('', 4), part('التلاميذ ذكور', 2), part('التلاميذ إناث', 2), part('التلاميذ مجموع', 2), part('الأساتذة', 3), part('المشرفون', 3)]);
  const line = (label: string, pick: (counts: { total: number; absent: number; present: number }) => number) =>
    spanRow(sheet, [part(label, 4), part(pick(students.male), 2), part(pick(students.female), 2), part(pick(students.all), 2), part(pick(teachers), 3), part(pick(supervisors), 3)]);
  line('المجموع', (c) => c.total);
  line('الغائبون', (c) => c.absent);
  line('الحاضرون', (c) => c.present);
}

export function buildPage2Sheet(render: Page2Render): XLSX.WorkSheet {
  const sheet = new SheetBuilder(PAGE2_COLUMNS);
  const { header } = render;
  spanRow(sheet, [part(`مديرية التربية لولاية : ${header.wilaya}`, 8), part(`السنة الدراسية : ${header.schoolYear}`, 8)]);
  spanRow(sheet, [part(`المؤسسة : ${header.institution}`, 8), part(`الرقم : ${header.reportNumber}`, 8)]);
  sheet.fullWidth('1- مواضبة الأساتذة / 1-1 دروس لم تقدم');
  addPage2Teachers(sheet, render);
  sheet.fullWidth('2-1 ملاحظات و إجراءات');
  sheet.fullWidth(render.observations || '/');
  sheet.fullWidth('2 - مراقبة المطعم');
  const canteen = render.computed.canteen;
  spanRow(sheet, [part('نصف داخلي (المجموع)', 4), part('الحاضرون', 4), part('الغائبون', 4), part('أسماء الغائبين', 4)]);
  spanRow(sheet, [part(canteen.halfBoarders, 4), part(canteen.present, 4), part(canteen.absent, 4), part(canteen.absentNames.filter(Boolean).join(' ، '), 4)]);
  sheet.fullWidth(CANTEEN_SOURCE_LABELS[canteen.source]);
  sheet.fullWidth(render.canteenNote);
  sheet.fullWidth('3- مراقبة التلاميذ / 1-3 الغيابات');
  sheet.fullWidth(`يحسب التلميذ غائبا إذا كان : ${COUNT_RULE_LABELS[render.countRule]}`);
  addPage2Levels(sheet, render);
  sheet.fullWidth('2-3 غيابات وتأخرات المشرفون التربويون');
  addPage2Supervisors(sheet, render);
  sheet.fullWidth('الخلاصة');
  addPage2Summary(sheet, render);
  spanRow(sheet, [part('ملاحظات حول النظافة الصيانة والإتلاف – الحوادث – النشاط الثقافي والرياضي – دروس الدعم – الزيارات', 8), part('ملاحظات مدير المؤسسة', 8)]);
  spanRow(sheet, [part(render.counselorNotes, 8), part('', 8)]);
  spanRow(sheet, [part('امضاء المستشار', 8), part('امضاء المدير', 8)]);
  sheet.fullWidth(footerText(header.city, header.reportDate));

  const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
  worksheet['!merges'] = sheet.merges;
  worksheet['!cols'] = Array.from({ length: PAGE2_COLUMNS }, (_, index) => ({ wch: index === 1 || index === 2 ? 14 : 8 }));
  return worksheet;
}

export function exportDailyReportExcel(page1: Page1Render, page2: Page2Render, filename: string): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildPage2Sheet(page2), 'Feuil8');
  XLSX.utils.book_append_sheet(workbook, buildPage1Sheet(page1), 'Feuil1');
  workbook.Workbook = {
    ...workbook.Workbook,
    Sheets: [{ RTL: true } as XLSX.SheetProps, { RTL: true } as XLSX.SheetProps],
  };
  saveWorkbook(workbook, filename);
}
