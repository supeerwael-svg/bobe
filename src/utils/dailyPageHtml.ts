import type { BoardingStatus, ParentCorrespondenceRow } from '@/db/types';
import type { StudentDayAbsence } from '@/utils/dailyPage1';
import { formatPeriods } from '@/utils/dailyPage1';

export interface Page1Render {
  wholeDay: StudentDayAbsence[];
  partial: StudentDayAbsence[];
  parentRows: ParentCorrespondenceRow[];
  counselorNotes: string;
}

const PARENT_MIN_ROWS = 10;
const WHOLE_TABLE_ROWS = 30;
export const WHOLE_BLOCK_SIZE = WHOLE_TABLE_ROWS * 2;

export const BOARDING_LABELS: Record<BoardingStatus, string> = {
  'half-boarder': 'نصف داخلي',
  external: 'خارجي',
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const DAILY_REPORT_CSS = `
@page { size: A4 portrait; margin: 0; }
.dr-page { box-sizing: border-box; width: 210mm; height: 297mm; overflow: hidden; padding: 10mm; break-after: page; background: #fff; color: #000; font-family: Cairo, Arial, sans-serif; font-size: 9pt; line-height: 1.5; direction: rtl; position: relative; }
.dr-title { border: 1px solid #000; text-align: center; font-weight: 700; font-size: 10.5pt; line-height: 1.2; padding: 2mm; margin-bottom: 3mm; }
.dr-split { display: flex; gap: 3mm; align-items: flex-start; }
.dr-split > table { flex: 1; }
.dr-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 3mm; }
.dr-table th, .dr-table td { border: 1px solid #000; padding: 0 1mm; height: 4.6mm; font-size: 8pt; line-height: 1.2; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
.dr-table th { font-weight: 700; background: #f2f2f2; }
.dr-table .dr-name { text-align: right; padding-right: 1.5mm; }
.dr-box { border: 1px solid #000; padding: 1.5mm 2mm; margin-bottom: 3mm; min-height: 12mm; white-space: pre-wrap; font-size: 8.5pt; }
.dr-section-title { font-weight: 700; font-size: 9pt; margin-bottom: 1mm; }
.dr-boxes { display: flex; gap: 3mm; }
.dr-boxes > div { flex: 1; border: 1px solid #000; padding: 1.5mm 2mm; min-height: 24mm; font-size: 8.5pt; }
.dr-sign { margin-top: 6mm; text-align: left; font-size: 8.5pt; }
.dr-footer { margin-top: 3mm; text-align: center; font-weight: 700; font-size: 9pt; }
.dr-editable { cursor: pointer; border-radius: 2px; }
.dr-editable:hover { outline: 1px dashed #2563eb; outline-offset: 2px; }
.dr-head { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 3mm; border: 1px solid #000; padding: 1.5mm 2mm; margin-bottom: 3mm; font-size: 8.5pt; font-weight: 700; }
.dr-rule { font-size: 8pt; margin-bottom: 1mm; }
.dr-gap { width: 1.5mm; padding: 0; border-left: 0; border-right: 0; background: #fff; }
.dr-page-2 .dr-table { margin-bottom: 2mm; }
.dr-page-2 .dr-box { min-height: 6mm; margin-bottom: 2mm; }
.dr-page-2 .dr-boxes > div { min-height: 18mm; }
@media print {
  .dr-page { page-break-after: always; break-after: page; }
  .dr-page:last-child { page-break-after: auto; break-after: auto; }
  .dr-editable:hover { outline: none; }
}
`;

export const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ESCAPES[char]);

export function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function cell(value: string, className = ''): string {
  const attr = className ? ` class="${className}"` : '';
  return `<td${attr}>${value ? esc(value) : '&nbsp;'}</td>`;
}

function wholeRow(item: StudentDayAbsence | undefined, number: number): string {
  if (!item) return `<tr><td>${number}</td><td class="dr-name"></td><td></td><td></td><td></td></tr>`;
  return `<tr>${cell(String(number))}${cell(item.name, 'dr-name')}${cell(item.className)}${cell(BOARDING_LABELS[item.boarding])}${cell(formatDate(item.since))}</tr>`;
}

const WHOLE_HEADERS = ['الرقم', 'اللقب و الاسم', 'القسم', 'الصفة', 'تاريخ الغياب'];

function wholeTable(items: StudentDayAbsence[], start: number, offset: number): string {
  const head = `<tr>${WHOLE_HEADERS.map((title) => `<th>${title}</th>`).join('')}</tr>`;
  const body = Array.from({ length: WHOLE_TABLE_ROWS }, (_, row) =>
    wholeRow(items[start + row], offset + row + 1),
  ).join('');
  return `<table class="dr-table"><colgroup><col style="width:7%"><col style="width:37%"><col style="width:14%"><col style="width:16%"><col style="width:26%"></colgroup><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function wholeBlock(items: StudentDayAbsence[], start: number): string {
  return `<div class="dr-split">${wholeTable(items, start, start)}${wholeTable(items, start + WHOLE_TABLE_ROWS, start + WHOLE_TABLE_ROWS)}</div>`;
}

function partialLines(items: StudentDayAbsence[]): string {
  return items
    .map((item) => `${item.name} - ${item.className} - ${formatPeriods(item.periods)}`)
    .join('\n');
}

const PARENT_HEADERS = ['الرقم', 'اللقب و الاسم', 'القسم', 'ساعات', 'تاريخ الغياب', 'الأسباب', 'اشعار اول', 'اشعار ثاني', 'اعذار', 'تاريخ الشطب'];

function parentRows(rows: ParentCorrespondenceRow[]): string {
  const total = Math.max(PARENT_MIN_ROWS, rows.length);
  return Array.from({ length: total }, (_, index) => {
    const row = rows[index];
    if (!row) return `<tr>${cell(String(index + 1))}${cell('', 'dr-name')}${cell('')}${cell('')}${cell('')}${cell('')}${cell('')}${cell('')}${cell('')}${cell('')}</tr>`;
    return `<tr>${cell(String(index + 1))}${cell(row.name, 'dr-name')}${cell(row.className)}${cell(row.hours)}${cell(formatDate(row.absenceDate))}${cell(row.reason)}${cell(row.firstNotice)}${cell(row.secondNotice)}${cell(row.excuse)}${cell(formatDate(row.struckDate))}</tr>`;
  }).join('');
}

export function footerDate(reportDate: string): string {
  if (!reportDate) return '....../....../......';
  const [year, month, day] = reportDate.split('-');
  return `${day} / ${month} / ${year}`;
}

export function footerText(city: string, reportDate: string): string {
  return `${city ? `${esc(city)} ` : ''}في : ${footerDate(reportDate)}`;
}

export function buildStudentPagesHtml(render: Page1Render): string[] {
  const headRow = `<tr>${PARENT_HEADERS.map((title) => `<th>${title}</th>`).join('')}</tr>`;
  const parents = `<table class="dr-table"><colgroup><col style="width:5%"><col style="width:17%"><col style="width:8%"><col style="width:6%"><col style="width:10%"><col style="width:14%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:13%"></colgroup><thead>${headRow}</thead><tbody>${parentRows(render.parentRows)}</tbody></table>`;
  const partial = partialLines(render.partial);
  const title = '<div class="dr-title">التلاميذ الغائبون إلى نهاية اليوم : (يسجل التلاميذ المتغيبين لمدة يوم أو أكثر فقط)</div>';
  const blockCount = Math.max(1, Math.ceil(render.wholeDay.length / WHOLE_BLOCK_SIZE));
  return Array.from({ length: blockCount }, (_, block) => {
    const blockHtml = `<div class="dr-editable-zone">${wholeBlock(render.wholeDay, block * WHOLE_BLOCK_SIZE)}</div>`;
    if (block > 0) return `<section class="dr-page">${title}${blockHtml}</section>`;
    return `<section class="dr-page">
${title}
${blockHtml}
<div class="dr-section-title">التلاميذ الغائبون لبعض الحصص</div>
<div class="dr-box">${partial ? esc(partial) : '&nbsp;'}</div>
<div class="dr-editable" data-edit="parents">
<div class="dr-section-title">مراسلات أولياء التلاميذ</div>
${parents}
</div>
<div class="dr-boxes">
<div class="dr-editable" data-edit="counselor"><div class="dr-section-title">المستشار(ة) التربوي(ة)</div><div style="white-space:pre-wrap">${render.counselorNotes ? esc(render.counselorNotes) : '&nbsp;'}</div><div class="dr-sign">الإمضاء :</div></div>
<div><div class="dr-section-title">مدير(ة) المؤسسة</div><div class="dr-sign">الإمضاء :</div></div>
</div>
</section>`;
  });
}

