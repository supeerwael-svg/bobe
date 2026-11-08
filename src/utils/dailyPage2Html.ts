import type { AbsenceCountRule, SupervisorAbsenceRow, TeacherAbsenceReason } from '@/db/types';
import { absenceRate, formatRate } from '@/utils/dailyReportStats';
import type { CanteenRender, Page2Computed } from '@/utils/dailyPage2';
import { esc, footerText } from '@/utils/dailyPageHtml';

export interface Page2Header {
  wilaya: string;
  schoolYear: string;
  institution: string;
  reportNumber: string;
  city: string;
  reportDate: string;
}

export interface Page2Render {
  header: Page2Header;
  countRule: AbsenceCountRule;
  computed: Page2Computed;
  observations: string;
  canteenNote: string;
  supervisorRows: SupervisorAbsenceRow[];
  counselorNotes: string;
}

export const TEACHER_MIN_ROWS = 8;
export const SUPERVISOR_MIN_ROWS = 6;
export const LEVEL_CLASSES_PER_ROW = 12;
export const GAP_AFTER_PERIOD = 4;

export const COUNT_RULE_LABELS: Record<AbsenceCountRule, string> = {
  wholeDay: 'غائب طيلة اليوم',
  anyPeriod: 'غائب في حصة واحدة على الأقل',
};

export const REASON_LABELS: Record<TeacherAbsenceReason, string> = {
  sickLeave: 'عطلة مرضية',
  requested: 'طلب غياب',
  other: 'أخرى',
};

export const SUPERVISOR_LABELS = { none: '', absent: 'غائب', late: 'متأخر' } as const;

export const CANTEEN_SOURCE_LABELS: Record<CanteenRender['source'], string> = {
  scans: 'مصدر المعطيات: مسح بطاقات المطعم',
  calculated: 'مصدر المعطيات: حساب من غيابات الأيام (لم يسجل أي مسح لهذا اليوم)',
  beforeTracking: 'مصدر المعطيات: قبل بدء متابعة المطعم (حساب من الغيابات)',
};

const cell = (value: string | number, attrs = '') =>
  `<td${attrs ? ` ${attrs}` : ''}>${value === '' ? '&nbsp;' : esc(String(value))}</td>`;
const head = (titles: string[]) => `<tr>${titles.map((title) => `<th>${title}</th>`).join('')}</tr>`;

function teacherTable(render: Page2Render): string {
  const { periods, teacherLines } = render.computed;
  const headTitles = [
    'الرقم',
    'اللقب والاسم',
    'المادة',
    ...periods.flatMap((period) => (period === GAP_AFTER_PERIOD + 1 ? ['', `الحصة ${period}`] : [`الحصة ${period}`])),
    'ملاحظات',
  ];
  const rowCount = Math.max(TEACHER_MIN_ROWS, teacherLines.length);
  const body = Array.from({ length: rowCount }, (_, index) => {
    const line = teacherLines[index];
    const marks = periods.flatMap((period) => {
      const mark = cell(line?.classByPeriod[period] ?? '', 'class="dr-class"');
      return period === GAP_AFTER_PERIOD + 1 ? ['<td class="dr-gap"></td>', mark] : [mark];
    });
    const note = line
      ? [line.reason ? REASON_LABELS[line.reason] : '', line.reasonNote, line.note].filter(Boolean).join(' - ')
      : '';
    return `<tr>${cell(index + 1)}${cell(line?.name ?? '', 'class="dr-name"')}${cell(line?.subjects ?? '', 'class="dr-name"')}${marks.join('')}${cell(note, 'class="dr-name"')}</tr>`;
  }).join('');
  return `<table class="dr-table"><thead>${head(headTitles)}</thead><tbody>${body}</tbody></table>`;
}

function levelTable(computed: Page2Computed): string {
  const headRow = `<tr><th></th>${Array.from({ length: LEVEL_CLASSES_PER_ROW }, () => '<th></th>').join('')}<th>تلاميذ</th><th>الغائبون</th><th>نسبة الغياب</th></tr>`;
  const levelRows = computed.levels
    .map((level) => {
      const pairs = Math.max(1, Math.ceil(level.classes.length / LEVEL_CLASSES_PER_ROW));
      const span = 2 * pairs;
      return Array.from({ length: pairs }, (_, pair) => {
        const slice = level.classes.slice(pair * LEVEL_CLASSES_PER_ROW, (pair + 1) * LEVEL_CLASSES_PER_ROW);
        const names = Array.from({ length: LEVEL_CLASSES_PER_ROW }, (__, index) => cell(slice[index]?.className ?? ''));
        const counts = Array.from({ length: LEVEL_CLASSES_PER_ROW }, (__, index) => cell(slice[index] ? slice[index].absent : ''));
        const label = pair === 0 ? cell(`الأقسام السنة ${level.level}`, 'class="dr-name"') : cell('');
        const totals =
          pair === 0
            ? `<td rowspan="${span}">${level.enrolled}</td><td rowspan="${span}">${level.absent}</td><td rowspan="${span}">${formatRate(level.rate)}</td>`
            : '';
        return `<tr>${label}${names.join('')}${totals}</tr><tr>${cell('عدد الغائبين', 'class="dr-name"')}${counts.join('')}</tr>`;
      }).join('');
    })
    .join('');
  const enrolled = computed.levels.reduce((sum, level) => sum + level.enrolled, 0);
  const absent = computed.levels.reduce((sum, level) => sum + level.absent, 0);
  const totalRow = `<tr>${cell('مجموع', 'class="dr-name"')}<td colspan="${LEVEL_CLASSES_PER_ROW}"></td>${cell(enrolled)}${cell(absent)}${cell(formatRate(absenceRate(absent, enrolled)))}</tr>`;
  return `<table class="dr-table dr-levels"><thead>${headRow}</thead><tbody>${levelRows}${totalRow}</tbody></table>`;
}

function supervisorTable(rows: SupervisorAbsenceRow[]): string {
  const count = Math.max(SUPERVISOR_MIN_ROWS, rows.length);
  const body = Array.from({ length: count }, (_, index) => {
    const row = rows[index];
    return `<tr>${cell(index + 1)}${cell(row?.name ?? '', 'class="dr-name"')}${cell(row ? SUPERVISOR_LABELS[row.morning] : '')}${cell(row ? SUPERVISOR_LABELS[row.evening] : '')}${cell(row?.notes ?? '', 'class="dr-name"')}</tr>`;
  }).join('');
  return `<table class="dr-table"><thead>${head(['الرقم', 'اسم المشرف التربوي', 'صباحا', 'مساءا', 'الملاحظات'])}</thead><tbody>${body}</tbody></table>`;
}

function summaryTable(computed: Page2Computed): string {
  const { students, teachers, supervisors } = computed.summary;
  const row = (label: string, pick: (counts: { total: number; absent: number; present: number }) => number) =>
    `<tr>${cell(label, 'class="dr-name"')}${cell(pick(students.male))}${cell(pick(students.female))}${cell(pick(students.all))}${cell(pick(teachers))}${cell(pick(supervisors))}</tr>`;
  return `<table class="dr-table"><thead>${head(['', 'التلاميذ ذكور', 'التلاميذ إناث', 'التلاميذ مجموع', 'الأساتذة', 'المشرفون'])}</thead><tbody>${row('المجموع', (c) => c.total)}${row('الغائبون', (c) => c.absent)}${row('الحاضرون', (c) => c.present)}</tbody></table>`;
}

function canteenTable(computed: Page2Computed): string {
  const { canteen } = computed;
  const names = canteen.absentNames.filter(Boolean).join(' ، ');
  return `<table class="dr-table"><thead>${head(['نصف داخلي (المجموع)', 'الحاضرون', 'الغائبون', 'أسماء الغائبين'])}</thead><tbody><tr>${cell(canteen.halfBoarders)}${cell(canteen.present)}${cell(canteen.absent)}${cell(names, 'class="dr-name"')}</tr></tbody></table><div class="dr-rule">${CANTEEN_SOURCE_LABELS[canteen.source]}</div>`;
}

export function buildPage2Html(render: Page2Render): string {
  const { header, computed } = render;
  return `<section class="dr-page dr-page-2">
<div class="dr-head">
<div>مديرية التربية لولاية : ${esc(header.wilaya)}</div>
<div>السنة الدراسية : ${esc(header.schoolYear)}</div>
<div>المؤسسة : ${esc(header.institution)}</div>
<div>الرقم : ${esc(header.reportNumber)}</div>
</div>
<div class="dr-section-title">1- مواضبة الأساتذة / 1-1 دروس لم تقدم</div>
<div class="dr-editable" data-edit="teachers">${teacherTable(render)}</div>
<div class="dr-section-title">2-1 ملاحظات و إجراءات</div>
<div class="dr-editable dr-box" data-edit="observations">${esc(render.observations || '/')}</div>
<div class="dr-section-title">2 - مراقبة المطعم</div>
<div class="dr-editable" data-edit="canteen">${canteenTable(computed)}<div class="dr-box">${render.canteenNote ? esc(render.canteenNote) : '&nbsp;'}</div></div>
<div class="dr-section-title">3- مراقبة التلاميذ / 1-3 الغيابات</div>
<div class="dr-rule">يحسب التلميذ غائبا إذا كان : ${COUNT_RULE_LABELS[render.countRule]}</div>
${levelTable(computed)}
<div class="dr-section-title">2-3 غيابات وتأخرات المشرفون التربويون</div>
<div class="dr-editable" data-edit="supervisors">${supervisorTable(render.supervisorRows)}</div>
<div class="dr-section-title">الخلاصة</div>
${summaryTable(computed)}
<div class="dr-boxes">
<div class="dr-editable" data-edit="counselor"><div class="dr-section-title">ملاحظات حول النظافة الصيانة والإتلاف – الحوادث – النشاط الثقافي والرياضي – دروس الدعم – الزيارات</div><div style="white-space:pre-wrap">${render.counselorNotes ? esc(render.counselorNotes) : '&nbsp;'}</div><div class="dr-sign">امضاء المستشار</div></div>
<div><div class="dr-section-title">ملاحظات مدير المؤسسة</div><div class="dr-sign">امضاء المدير</div></div>
</div>
<div class="dr-footer">${footerText(header.city, header.reportDate)}</div>
</section>`;
}
