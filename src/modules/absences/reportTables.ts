import type { PrintableSection } from '@/utils/printReport';
import type { WorkbookSheet } from '@/utils/spreadsheet';
import type { MonthlyReport } from '@/modules/absences/reportData';

export type Translate = (key: string, options?: Record<string, string | number>) => string;

export interface ReportTable extends PrintableSection {
  sheetName: string;
  emptyLabel: string;
}

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(2)}%`;
}

export function monthlyReportTables(report: MonthlyReport, t: Translate): ReportTable[] {
  const movementHeaders = [t('reports.columns.student'), t('reports.columns.class'), t('reports.columns.date')];
  return [
    {
      sheetName: t('reports.sheets.rates'),
      heading: t('reports.monthly.rateSection'),
      emptyLabel: t('reports.monthly.noClasses'),
      headers: [
        t('reports.columns.class'),
        t('reports.columns.studentCount'),
        t('reports.columns.classHours'),
        t('reports.columns.requiredHours'),
        t('reports.columns.absentHours'),
        t('reports.columns.rate'),
      ],
      rows: report.rows.map((row) => {
        let rateCell = formatRate(row.rate);
        if (row.rate === null) {
          const hint = !row.hasTimetable
            ? t('reports.monthly.noTimetable')
            : row.studentCount === 0
              ? t('reports.monthly.noStudents')
              : t('reports.monthly.noRequiredHours');
          rateCell = `${formatRate(row.rate)} (${hint})`;
        }
        return [
          row.className,
          String(row.studentCount),
          String(row.classHours),
          String(row.requiredHours),
          String(row.hours),
          rateCell,
        ];
      }),
      footer: [
        t('reports.monthly.institutionTotal'),
        String(report.total.studentCount),
        String(report.total.classHours),
        String(report.total.requiredHours),
        String(report.total.hours),
        formatRate(report.total.rate),
      ],
    },
    {
      sheetName: t('reports.sheets.joined'),
      heading: t('reports.monthly.joinedSection'),
      emptyLabel: t('reports.monthly.noMovements'),
      headers: movementHeaders,
      rows: report.joined.map((line) => [line.name, line.className, line.date]),
      footer: null,
    },
    {
      sheetName: t('reports.sheets.left'),
      heading: t('reports.monthly.leftSection'),
      emptyLabel: t('reports.monthly.noMovements'),
      headers: movementHeaders,
      rows: report.left.map((line) => [line.name, line.className, line.date]),
      footer: null,
    },
  ];
}

export function toWorkbookSheets(tables: ReportTable[]): WorkbookSheet[] {
  return tables.map((table) => ({
    name: table.sheetName,
    headers: table.headers,
    rows: table.rows,
    footer: table.footer,
  }));
}
